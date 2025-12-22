import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoomInput } from '@/lib/validation'
import { isExternalCustomer } from '@/lib/user-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/rooms
 * List rooms that the user is a member of
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      console.error('GET /api/chat/rooms - No session or user')
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      }, { status: 401 })
    }

    if (!session.user.id) {
      console.error('GET /api/chat/rooms - Session user missing id:', {
        user: session.user,
        email: session.user.email,
      })
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'User ID not found in session',
      }, { status: 401 })
    }

    console.log('GET /api/chat/rooms - Fetching rooms for user:', {
      sessionUserId: session.user.id,
      sessionEmail: session.user.email,
    })

    // Verify the user exists in DB and get their actual ID and department
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, email: true, role: true, department: true },
    })

    if (!dbUser) {
      console.error('GET /api/chat/rooms - User not found in database:', session.user.email)
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Use DB user ID (source of truth)
    const userId = dbUser.id
    const sessionIdMatches = session.user.id === dbUser.id

    console.log('GET /api/chat/rooms - User lookup:', {
      sessionUserId: session.user.id,
      dbUserId: dbUser.id,
      idMatch: sessionIdMatches,
      email: session.user.email,
    })

    if (!sessionIdMatches) {
      console.warn('⚠️ Session user ID does not match DB user ID! Using DB ID.')
    }

    const isAdmin = dbUser.role === 'ADMIN'
    
    // Check if user is external customer (they need to see TICKET rooms)
    const userIsExternal = await isExternalCustomer(userId)

    // Fetch rooms where user is a member (use DB user ID)
    // PRIVATE rooms: only visible to members (admins don't auto-see)
    // PUBLIC rooms: visible based on department rules below
    // TICKET rooms: only for external customers (they only see their own tickets)
    const roomTypes = userIsExternal 
      ? ['PUBLIC', 'PRIVATE', 'TICKET'] // External customers see their tickets
      : ['PUBLIC', 'PRIVATE'] // Internal users don't see tickets in main sidebar (they use tickets tab)
    
    const memberships = await prisma.roomMember.findMany({
      where: {
        userId: userId, // Use DB user ID, not session user ID
        room: {
          type: { in: roomTypes },
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
            department: true,
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
          createdAt: 'asc',
        },
      },
    })

    // Start with rooms user is a member of
    let rooms = memberships
      .map((m) => ({
        ...m.room,
        role: m.role,
        lastMessage: m.room.messages[0] || null,
        otherUser: null,
      }))
      // Filter: PRIVATE rooms only if user is a member (already handled by query)
      // PUBLIC rooms: filter by department rules below
      // TICKET rooms: only for external customers (they only see their own tickets)
      .filter((r) => {
        if (r.type === 'TICKET') {
          // TICKET rooms: only show for external customers (they're members of their own tickets)
          return userIsExternal
        }
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
    const memberRoomIds = new Set(rooms.map((r) => r.id))
    
    const additionalRooms = await prisma.room.findMany({
      where: {
        type: 'PUBLIC', // Only PUBLIC rooms (PRIVATE rooms are invite-only)
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
        department: true,
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
    rooms = [
      ...rooms,
      ...additionalRooms.map((r) => ({
        ...r,
        role: null,
        lastMessage: r.messages[0] || null,
        otherUser: null,
      })),
    ]

    const roomTypeSummary = userIsExternal 
      ? 'DM excluded (TICKET included for external customers)'
      : 'DM and TICKET excluded'
    console.log('GET /api/chat/rooms - Found', rooms.length, 'rooms for user', session.user.id, `(${roomTypeSummary})`)

    return Response.json({
      ok: true,
      code: 'SUCCESS',
      message: 'Rooms retrieved successfully',
      data: {
        rooms,
      },
    })
  } catch (error: any) {
    console.error('Error fetching rooms:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

/**
 * POST /api/chat/rooms
 * Create a new room (internal users only)
 * External customers cannot create rooms
 * If type=PRIVATE, creator becomes OWNER
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      }, { status: 401 })
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'User not found',
      }, { status: 404 })
    }

    // Block external customers from creating rooms
    const userIsExternal = await isExternalCustomer(dbUser.id)
    if (userIsExternal) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'External customers cannot create rooms',
      }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validated = RoomInput.safeParse(body)
    if (!validated.success) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid room input',
        details: validated.error.errors,
      }, { status: 400 })
    }

    // Check if room name already exists
    const existingRoom = await prisma.room.findUnique({
      where: { name: validated.data.name },
    })

    if (existingRoom) {
      return Response.json({
        ok: false,
        code: 'ROOM_EXISTS',
        message: 'Room with this name already exists',
      }, { status: 409 })
    }

    // Determine room role: OWNER if PRIVATE, MEMBER if PUBLIC
    const creatorRole = validated.data.type === 'PRIVATE' ? 'OWNER' : 'MEMBER'

    // Create room
    const room = await prisma.room.create({
      data: {
        name: validated.data.name,
        title: validated.data.title,
        description: validated.data.description,
        tags: validated.data.tags,
        type: validated.data.type,
        isPrivate: validated.data.isPrivate || validated.data.type === 'PRIVATE',
        creatorId: session.user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    // Add creator as member (OWNER for PRIVATE, MEMBER for PUBLIC)
    await prisma.roomMember.create({
      data: {
        userId: session.user.id,
        roomId: room.id,
        role: creatorRole,
      },
    })

    return Response.json({
      ok: true,
      code: 'ROOM_CREATED',
      message: 'Room created successfully',
      data: {
        room,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating room:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

