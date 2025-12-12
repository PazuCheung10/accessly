import { redirect } from 'next/navigation'
import { HomePageClient } from '@/components/rooms/HomePageClient'
import { CustomerPortal } from '@/components/customer/CustomerPortal'
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
  // Visibility rules:
  //   - PRIVATE rooms: only visible to members (admins don't auto-see)
  //   - PUBLIC rooms: 
  //     * Admins see all PUBLIC rooms
  //     * Non-admins see only PUBLIC rooms matching their department or PUBLIC_GLOBAL
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
      lastMessage: m.room.messages[0] || null,
    }))
    // Filter: PRIVATE rooms only if user is a member (already handled by query)
    // PUBLIC rooms: filter by department rules
    .filter((r) => {
      if (r.type === 'PRIVATE') {
        // PRIVATE rooms: only if user is a member (already in memberships)
        return true
      }
      if (r.type === 'PUBLIC') {
        if (isAdmin) {
          // Admins see all PUBLIC rooms
          return true
        }
        // Non-admins: only see PUBLIC rooms matching their department or PUBLIC_GLOBAL
        return r.department === dbUser.department || r.department === null
      }
      return false
    })

  // For non-admins: also include PUBLIC rooms matching their department that they're not members of
  // For admins: also include all PUBLIC rooms they're not members of
  // PRIVATE rooms are NOT included here (invite-only)
  const memberRoomIds = new Set(myRooms.map((r) => r.id))
  
  const additionalRooms = await prisma.room.findMany({
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
              { department: dbUser.department }, // User's department
              { department: null }, // PUBLIC_GLOBAL
            ],
          }),
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

  // Add these rooms with null role (not a member yet, but visible due to department match or admin status)
  myRooms = [
    ...myRooms,
    ...additionalRooms.map((r) => ({
      ...r,
      role: null,
      lastMessage: r.messages[0] || null,
    })),
  ]

  // Get all unique tags from rooms the user can see (for filter chips)
  const allTags = Array.from(
    new Set(
      myRooms.flatMap((r) => r.tags || []).filter((t) => t.length > 0)
    )
  ).sort()

  // Check if user is external customer
  const userIsExternal = await isExternalCustomer(dbUser.id)

  // If external customer, show Customer Portal instead of Rooms UI
  if (userIsExternal) {
    return <CustomerPortal />
  }

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
