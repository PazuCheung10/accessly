import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MessageInput, Pagination } from '@/lib/validation'
import { checkRate } from '@/lib/rateLimit'
import { getIO } from '@/lib/io'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/messages
 * List messages by roomId with cursor-based pagination
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const cursor = searchParams.get('cursor')
    const after = searchParams.get('after') // For fetching messages after a specific message ID
    const limitParam = searchParams.get('limit')

    if (!roomId) {
      return Response.json({
        ok: false,
        code: 'MISSING_PARAMETER',
        message: 'roomId is required',
      })
    }

    // Parse and validate pagination
    const paginationInput: any = {}
    if (cursor) paginationInput.cursor = cursor
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit)) paginationInput.limit = parsedLimit
    }

    const pagination = Pagination.safeParse(paginationInput)

    if (!pagination.success) {
      return Response.json({
        ok: false,
        code: 'INVALID_PAGINATION',
        message: 'Invalid pagination parameters',
        details: pagination.error.errors,
      })
    }

    const { limit } = pagination.data

    // Check if room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { type: true, isPrivate: true },
    })

    if (!room) {
      return Response.json({
        ok: false,
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      }, { status: 404 })
    }

    // Verify the user exists in DB and get their actual ID
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, email: true },
    })

    if (!dbUser) {
      console.error('GET /api/chat/messages - User not found in database:', session.user.email)
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Use DB user ID (source of truth)
    const userId = dbUser.id

    // Check if user is member of the room (required for all rooms) - use DB user ID
    const membership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: userId, // Use DB user ID
          roomId,
        },
      },
    })

    if (!membership) {
      console.error('GET /api/chat/messages - User not a member:', {
        userId,
        roomId,
        sessionUserId: session.user.id,
      })
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Not a member of this room',
      }, { status: 403 })
    }

    // Fetch messages
    const messages = await prisma.message.findMany({
      where: {
        roomId,
        ...(cursor && {
          id: {
            lt: cursor, // For pagination backwards (older messages)
          },
        }),
        ...(after && {
          id: {
            gt: after, // For fetching newer messages after a specific ID
          },
        }),
      },
      take: limit,
      orderBy: {
        createdAt: after ? 'asc' : 'desc', // Ascending for after, descending for cursor
      },
      select: {
        id: true,
        roomId: true,
        userId: true,
        content: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        reactions: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    // Reverse to get chronological order (oldest first) - only if using cursor (descending order)
    // If using 'after', messages are already in ascending order
    const orderedMessages = after ? messages : messages.reverse()
    const nextCursor = orderedMessages.length > 0 ? orderedMessages[0].id : null

    console.log('GET /api/chat/messages - Found messages:', {
      roomId,
      userId,
      count: orderedMessages.length,
      hasMessages: orderedMessages.length > 0,
      firstMessageId: orderedMessages[0]?.id,
      lastMessageId: orderedMessages[orderedMessages.length - 1]?.id,
    })

    return Response.json({
      ok: true,
      data: {
        messages: orderedMessages,
        cursor: nextCursor,
        hasMore: messages.length === limit,
      },
    })
  } catch (error: any) {
    console.error('Error fetching messages:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    })
  }
}

/**
 * POST /api/chat/messages
 * Create a new message with validation, rate limiting, and persistence
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      })
    }

    const body = await request.json()

    // Validate input
    const validated = MessageInput.safeParse(body)
    if (!validated.success) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid message input',
        details: validated.error.errors,
      })
    }

    // Verify the user exists in DB and get their actual ID
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, email: true },
    })

    if (!dbUser) {
      console.error('POST /api/chat/messages - User not found in database:', session.user.email)
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Use DB user ID (source of truth)
    const userId = dbUser.id

    // Rate limiting (use DB user ID)
    try {
      checkRate(userId)
    } catch (error: any) {
      if (error.code === 'RATE_LIMITED') {
        return Response.json({
          ok: false,
          code: 'RATE_LIMITED',
          message: error.message,
        })
      }
      throw error
    }

    // Check if user is member of the room (use DB user ID)
    const membership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: userId, // Use DB user ID
          roomId: validated.data.roomId,
        },
      },
    })

    if (!membership) {
      console.error('POST /api/chat/messages - User not a member:', {
        userId,
        roomId: validated.data.roomId,
        sessionUserId: session.user.id,
      })
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Not a member of this room',
      }, { status: 403 })
    }

    // Persist message to database (use DB user ID)
    const message = await prisma.message.create({
      data: {
        roomId: validated.data.roomId,
        userId: userId, // Use DB user ID
        content: validated.data.content,
      },
      select: {
        id: true,
        roomId: true,
        userId: true,
        content: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        reactions: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    // Emit Socket.io event to room
    const io = getIO()
    if (io) {
      // Ensure user object is included in socket event
      io.to(validated.data.roomId).emit('message:new', {
        id: message.id,
        roomId: message.roomId,
        userId: message.userId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt?.toISOString() || null,
        deletedAt: message.deletedAt?.toISOString() || null,
        reactions: message.reactions || null,
        user: {
          id: message.user.id,
          name: message.user.name,
          image: message.user.image,
        },
      })
    }

    return Response.json({
      ok: true,
      data: message,
    })
  } catch (error: any) {
    console.error('Error creating message:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    })
  }
}
