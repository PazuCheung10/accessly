import { redirect } from 'next/navigation'
import { HomePageClient } from '@/components/rooms/HomePageClient'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoomType } from '@prisma/client'

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
    select: { id: true },
  })

  if (!dbUser) {
    redirect('/sign-in?callbackUrl=/')
  }

  const params = await searchParams
  const q = params.q || ''
  const tag = params.tag || ''
  const sort = params.sort || 'active'
  const cursor = params.cursor || null
  const limit = 20

  // Fetch "My Rooms" - rooms user is a member of
  const myMemberships = await prisma.roomMember.findMany({
    where: { userId: dbUser.id },
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

  const myRooms = myMemberships.map((m) => ({
    ...m.room,
    role: m.role,
    lastMessage: m.room.messages[0] || null,
  }))

  // Fetch "Discover" - public rooms with filters
  const where: any = {
    type: RoomType.PUBLIC,
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (tag) {
    where.tags = { has: tag }
  }

  if (cursor) {
    where.id = { lt: cursor }
  }

  let orderBy: any = {}
  switch (sort) {
    case 'new':
      orderBy = { createdAt: 'desc' }
      break
    case 'members':
      orderBy = { members: { _count: 'desc' } }
      break
    case 'active':
    default:
      // For "most active", sort by message count (rooms with more messages are more active)
      // Alternatively, we could sort by createdAt desc as a proxy
      orderBy = { messages: { _count: 'desc' } }
      break
  }

  const discoverRooms = await prisma.room.findMany({
    where,
    take: limit + 1,
    orderBy,
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

  const hasMore = discoverRooms.length > limit
  const discoverRoomsToReturn = hasMore ? discoverRooms.slice(0, limit) : discoverRooms
  const nextCursor = hasMore && discoverRoomsToReturn.length > 0
    ? discoverRoomsToReturn[discoverRoomsToReturn.length - 1].id
    : null

  const discoverRoomsWithLastMessage = discoverRoomsToReturn.map((room) => ({
    ...room,
    lastMessage: room.messages[0] || null,
  }))

  // Get all unique tags from public rooms for filter chips
  const allPublicRooms = await prisma.room.findMany({
    where: { type: RoomType.PUBLIC },
    select: { tags: true },
  })
  const allTags = Array.from(
    new Set(
      allPublicRooms.flatMap((r) => r.tags || []).filter((t) => t.length > 0)
    )
  ).sort()

  return (
    <HomePageClient
      initialMyRooms={myRooms}
      initialDiscoverRooms={discoverRoomsWithLastMessage}
      initialCursor={nextCursor}
      initialHasMore={hasMore}
      availableTags={allTags}
      initialFilters={{
        q,
        tag,
        sort,
      }}
    />
  )
}
