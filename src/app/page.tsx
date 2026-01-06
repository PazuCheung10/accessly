import { redirect } from 'next/navigation'
import { HomePageClient } from '@/components/rooms/HomePageClient'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoomType } from '@prisma/client'
import { isExternalCustomer } from '@/lib/user-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; cursor?: string }>
}) {
  const session = await auth()

  // If not logged in, redirect to sign-in
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/')
  }

  // Verify user exists in DB
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email || '' },
    select: { id: true, role: true, department: true },
  })

  if (!dbUser) {
    redirect('/sign-in?callbackUrl=/')
  }

  // Block external customers from accessing internal rooms
  const userIsExternal = await isExternalCustomer(dbUser.id)
  if (userIsExternal) {
    // External customers should not see internal rooms
    // Redirect them or show empty state
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
          <p className="text-slate-400">External customers cannot access internal collaboration rooms.</p>
        </div>
      </div>
    )
  }

  const params = await searchParams
  const q = params.q || ''
  const tag = params.tag || ''
  const sort = params.sort || 'active'
  const cursor = params.cursor || null
  const limit = 20

  // Fetch "My Rooms" - rooms user is a member of, EXCLUDING DMs and TICKETs
  // Home page only shows PUBLIC and PRIVATE team/community rooms
  // Simplified: All users see all PUBLIC rooms (no department filtering)
  const myMemberships = await prisma.roomMember.findMany({
    where: { 
      userId: dbUser.id,
      room: {
        type: { in: [RoomType.PUBLIC, RoomType.PRIVATE] }, // Only PUBLIC and PRIVATE on home page
      },
    },
    include: {
      room: {
        select: {
          id: true,
          name: true,
          title: true,
          description: true,
          tags: true,
          type: true,
          isPrivate: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              members: true,
              messages: true,
            },
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              id: true,
              content: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      },
    },
      orderBy: {
        room: {
          createdAt: 'desc',
        },
      },
  })

  let myRooms = myMemberships
    .map((m) => ({
      ...m.room,
      role: m.role,
      lastMessage: m.room.messages[0] ? {
        ...m.room.messages[0],
        createdAt: m.room.messages[0].createdAt.toISOString(),
      } : null,
    }))

  // For DEMO_OBSERVER: ONLY show rooms they're a member of (no additional rooms)
  // For other users: also include PUBLIC rooms they're not a member of
  const isDemoObserver = dbUser.role === 'DEMO_OBSERVER'
  const isAdmin = dbUser.role === 'ADMIN'
  
  let additionalRooms: any[] = []
  if (!isDemoObserver) {
    // Only fetch additional rooms for non-DEMO_OBSERVER users
    const memberRoomIds = new Set(myRooms.map((r) => r.id))
    
    additionalRooms = await prisma.room.findMany({
      where: {
        type: RoomType.PUBLIC, // Only PUBLIC rooms (PRIVATE rooms are invite-only)
        isPrivate: false,
        // Exclude rooms user is already a member of
        id: {
          notIn: Array.from(memberRoomIds),
        },
        // For admins: show all PUBLIC rooms
        // For non-admins: only show rooms matching their department or PUBLIC_GLOBAL
        ...(isAdmin
          ? {}
          : {
              OR: [
                { department: dbUser.department as any }, // User's department
                { department: null }, // PUBLIC_GLOBAL
              ] as any,
            }),
      } as any,
    select: {
      id: true,
      name: true,
      title: true,
      description: true,
          tags: true,
          type: true,
          isPrivate: true,
          createdAt: true,
          creator: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      _count: {
        select: {
          members: true,
          messages: true,
        },
      },
      messages: {
        take: 1,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
  })

  // Add these rooms with null role (not a member yet, but visible due to department match or admin status)
  myRooms = [
    ...myRooms,
      ...additionalRooms.map((r) => ({
        ...r,
        role: null as any,
        lastMessage: r.messages[0] ? {
          ...r.messages[0],
          createdAt: r.messages[0].createdAt.toISOString(),
        } : null,
      })),
    ]

  // Get all unique tags from rooms the user can see (for filter chips)
  const allTags = Array.from(
    new Set(
      myRooms.flatMap((r) => r.tags || []).filter((t) => t.length > 0)
    )
  ).sort()

  // Get user role from session
  const userRole = session.user.role === 'ADMIN' ? 'ADMIN' : 'USER'

  return (
    <HomePageClient
      initialRooms={myRooms}
      availableTags={allTags}
      initialFilters={{
        q,
        tag,
        sort,
      }}
      userRole={userRole}
    />
  )
}
