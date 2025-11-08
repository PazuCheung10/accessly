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

    // Fetch all messages in room (including replies) for hierarchical structure
    // Note: We fetch more than limit to ensure we get all replies for root messages
    const allMessages = await prisma.message.findMany({
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
      take: limit * 3, // Fetch more to account for replies
      orderBy: {
        createdAt: after ? 'asc' : 'desc', // Ascending for after, descending for cursor
      },
      select: {
        id: true,
        roomId: true,
        userId: true,
        content: true,
        parentMessageId: true,
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

    // Build hierarchical structure: separate root messages and replies
    const rootMessages: typeof allMessages = []
    const repliesByParent = new Map<string, typeof allMessages>()
    
    for (const msg of allMessages) {
      if (msg.parentMessageId) {
        const replies = repliesByParent.get(msg.parentMessageId) || []
        replies.push(msg)
        repliesByParent.set(msg.parentMessageId, replies)
      } else {
        rootMessages.push(msg)
      }
    }

    // Sort replies chronologically for each parent
    repliesByParent.forEach((replies) => {
      replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    })

    // Sort root messages chronologically
    rootMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    // Build hierarchical structure: attach replies to their parents
    const hierarchicalMessages = rootMessages.map((msg) => {
      const replies = repliesByParent.get(msg.id) || []
      return {
        ...msg,
        replies: replies.map((r) => ({
          id: r.id,
          roomId: r.roomId,
          userId: r.userId,
          content: r.content,
          parentMessageId: r.parentMessageId,
          createdAt: r.createdAt.toISOString(),
          editedAt: r.editedAt?.toISOString() || null,
          deletedAt: r.deletedAt?.toISOString() || null,
          reactions: r.reactions,
          user: r.user,
        })),
      }
    })

    // Convert to flat list for backward compatibility, but include replies structure
    const flatMessages = hierarchicalMessages.flatMap((msg) => {
      const base = {
        id: msg.id,
        roomId: msg.roomId,
        userId: msg.userId,
        content: msg.content,
        parentMessageId: msg.parentMessageId,
        createdAt: msg.createdAt.toISOString(),
        editedAt: msg.editedAt?.toISOString() || null,
        deletedAt: msg.deletedAt?.toISOString() || null,
        reactions: msg.reactions,
        user: msg.user,
        replies: msg.replies,
      }
      return [base, ...msg.replies]
    })

    // For pagination, we need to track the oldest root message ID
    const orderedMessages = after ? flatMessages : flatMessages.reverse()
    const nextCursor = rootMessages.length > 0 ? rootMessages[0].id : null

    console.log('GET /api/chat/messages - Found messages:', {
      roomId,
      userId,
      totalCount: allMessages.length,
      rootCount: rootMessages.length,
      repliesCount: allMessages.length - rootMessages.length,
      hasMessages: orderedMessages.length > 0,
      firstMessageId: orderedMessages[0]?.id,
      lastMessageId: orderedMessages[orderedMessages.length - 1]?.id,
    })

    return Response.json({
      ok: true,
      data: {
        messages: orderedMessages,
        hierarchicalMessages: hierarchicalMessages.map((msg) => ({
          ...msg,
          createdAt: msg.createdAt.toISOString(),
          editedAt: msg.editedAt?.toISOString() || null,
          deletedAt: msg.deletedAt?.toISOString() || null,
        })),
        cursor: nextCursor,
        hasMore: allMessages.length >= limit,
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
        parentMessageId: validated.data.parentMessageId || null,
      },
      select: {
        id: true,
        roomId: true,
        userId: true,
        content: true,
        parentMessageId: true,
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

    // Track room activity for telemetry
    const { trackRoomMessage } = await import('@/lib/telemetry')
    const room = await prisma.room.findUnique({
      where: { id: validated.data.roomId },
      select: { title: true },
    })
    if (room) {
      trackRoomMessage(validated.data.roomId, room.title)
    }

    // Emit Socket.io event to room
    const io = getIO()
    if (io) {
      // Ensure user object is included in socket event
      io.to(validated.data.roomId).emit('message:new', {
        id: message.id,
        roomId: message.roomId,
        userId: message.userId,
        content: message.content,
        parentMessageId: message.parentMessageId,
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
