import { redirect } from 'next/navigation'
import ChatPageClient from './ChatPageClient'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isExternalCustomer } from '@/lib/user-utils'
import { RoomType } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ room?: string; view?: string }> | { room?: string; view?: string }
}) {
  // Handle both Promise and direct object for searchParams (Next.js 15 compatibility)
  const params = searchParams instanceof Promise ? await searchParams : searchParams
  const initialRoomId = params?.room ?? null

  // Require authentication
  const session = await auth()
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/chat')
  }

  // Verify user exists in DB
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email || '' },
    select: { id: true, role: true },
  })

  if (!dbUser) {
    redirect('/sign-in?callbackUrl=/chat')
  }

  // If room ID is provided, verify access before rendering
  if (initialRoomId) {
    const room = await prisma.room.findUnique({
      where: { id: initialRoomId },
      select: { id: true, type: true, department: true },
    })

    if (!room) {
      // Room doesn't exist - redirect to home
      redirect('/')
    }

    // Check if user is external customer
    const userIsExternal = await isExternalCustomer(dbUser.id)
    const isAdmin = dbUser.role === 'ADMIN'

    // Block external customers from PUBLIC rooms
    if (room.type === RoomType.PUBLIC && userIsExternal) {
      redirect('/')
    }

    // For other room types, access control is handled by API endpoints
    // But we can do a quick check here for better UX
    if (room.type === RoomType.PRIVATE) {
      const membership = await prisma.roomMember.findUnique({
        where: {
          userId_roomId: {
            userId: dbUser.id,
            roomId: initialRoomId,
          },
        },
      })
      if (!membership) {
        redirect('/')
      }
    }
  }

  // View parameter is deprecated - we only show rooms now (no DM tab)
  return <ChatPageClient initialRoomId={initialRoomId} />
}
