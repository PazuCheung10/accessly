import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoomInput } from '@/lib/validation'

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

    // Verify the user exists in DB and get their actual ID
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, email: true },
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

    // Fetch rooms where user is a member (use DB user ID)
    const memberships = await prisma.roomMember.findMany({
      where: {
        userId: userId, // Use DB user ID, not session user ID
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
            members: {
              where: {
                userId: {
                  not: userId, // For DM rooms, get the other user
                },
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
              take: 1, // DM rooms should only have 1 other member
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

    const rooms = memberships
      .map((m) => ({
        ...m.room,
        role: m.role,
        lastMessage: m.room.messages[0] || null,
        // For DM rooms, include the other user (though DMs are filtered out below)
        otherUser: m.room.type === 'DM' && m.room.members[0] ? m.room.members[0].user : null,
      }))
      // Filter out DM and TICKET rooms - DMs are removed from UI, tickets are only accessible via /tickets page
      .filter((r) => r.type === 'PUBLIC' || r.type === 'PRIVATE')

    console.log('GET /api/chat/rooms - Found', rooms.length, 'rooms for user', session.user.id, '(filtered: DM and TICKET excluded)')

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
 * Create a new room (any authenticated user)
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

