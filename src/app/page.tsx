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

  // Verify user exists in DB and get their department
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email || '' },
    select: { id: true, role: true, department: true },
  })

  if (!dbUser) {
    redirect('/sign-in?callbackUrl=/')
  }

  const isAdmin = dbUser.role === 'ADMIN'

  const params = await searchParams
  const q = params.q || ''
  const tag = params.tag || ''
  const sort = params.sort || 'active'
  const cursor = params.cursor || null
  const limit = 20

  // Fetch "My Rooms" - rooms user is a member of, EXCLUDING DMs and TICKETs
  // Home page only shows PUBLIC and PRIVATE team/community rooms
  // For non-admins: show rooms where:
  //   a) room.department === user.department, OR
  //   b) room.department === null (PUBLIC_GLOBAL), OR
  //   c) user is explicitly a member
  // For admins: show all rooms
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

  let myRooms = myMemberships.map((m) => ({
    ...m.room,
    role: m.role,
    lastMessage: m.room.messages[0] || null,
  }))

  // For non-admins: also include department rooms and PUBLIC_GLOBAL rooms they're not members of
  if (!isAdmin && dbUser.department) {
    const memberRoomIds = new Set(myRooms.map((r) => r.id))
    
    const additionalRooms = await prisma.room.findMany({
      where: {
        type: { in: [RoomType.PUBLIC, RoomType.PRIVATE] },
        OR: [
          { department: dbUser.department }, // User's department
          { department: null }, // PUBLIC_GLOBAL
        ],
        // Exclude rooms user is already a member of
        id: {
          notIn: Array.from(memberRoomIds),
        },
      },
      select: {
        id: true,
        name: true,
        title: true,
        description: true,
        tags: true,
        type: true,
        isPrivate: true,
        createdAt: true,
        department: true,
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

    // Add these rooms with null role (not a member yet, but visible due to department match)
    myRooms = [
      ...myRooms,
      ...additionalRooms.map((r) => ({
        ...r,
        role: null,
        lastMessage: r.messages[0] || null,
      })),
    ]
  }

  // Fetch "Discover" - only PUBLIC_GLOBAL rooms (department === null)
  // Department-specific rooms are NOT discoverable
  const where: any = {
    type: RoomType.PUBLIC,
    department: null, // Only PUBLIC_GLOBAL rooms
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

  // Get user role from session
  const userRole = session.user.role === 'ADMIN' ? 'ADMIN' : 'USER'

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
      userRole={userRole}
    />
  )
}
