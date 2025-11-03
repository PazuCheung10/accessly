import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MessageInput, Pagination } from '@/lib/validation'
import { checkRate as rateLimitCheck } from '@/lib/rateLimit'
import { getIO } from '@/lib/io'

export const runtime = 'nodejs'

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

    // Check if user is member of the room
    const membership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: session.user.id,
          roomId,
        },
      },
    })

    if (!membership) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Not a member of this room',
      })
    }

    // Fetch messages
    const messages = await prisma.message.findMany({
      where: {
        roomId,
        ...(cursor && {
          id: {
            lt: cursor,
          },
        }),
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    // Reverse to get chronological order (oldest first)
    const orderedMessages = messages.reverse()
    const nextCursor = orderedMessages.length > 0 ? orderedMessages[0].id : null

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

    // Rate limiting (use userId)
    try {
      rateLimitCheck(session.user.id)
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

    // Check if user is member of the room
    const membership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: session.user.id,
          roomId: validated.data.roomId,
        },
      },
    })

    if (!membership) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Not a member of this room',
      })
    }

    // Persist message to database
    const message = await prisma.message.create({
      data: {
        roomId: validated.data.roomId,
        userId: session.user.id,
        content: validated.data.content,
      },
      include: {
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
      io.to(validated.data.roomId).emit('message:new', {
        id: message.id,
        roomId: message.roomId,
        userId: message.userId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        user: message.user,
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