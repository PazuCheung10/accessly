import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkMessageRate, RateLimitedError } from '@/lib/rateLimit'
import { MessageInput } from '@/lib/validation'
import { logger } from '@/lib/logger'

export type MessageCoreResponse =
  | { status: number; body: { ok: true; data: any } }
  | { status: number; body: { ok: false; code: string; message?: string } }

export async function handlePostMessageCore(req: Request): Promise<MessageCoreResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      status: 401,
      body: { ok: false, code: 'UNAUTHORIZED', message: 'Not signed in' },
    }
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.content !== 'string' || !body.roomId) {
    return {
      status: 400,
      body: { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid payload' },
    }
  }

  // Validate input
  const validated = MessageInput.safeParse(body)
  if (!validated.success) {
    return {
      status: 400,
      body: {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid payload',
        details: validated.error.errors,
      },
    }
  }

  const { roomId, content, parentMessageId } = validated.data

  // Verify the user exists in DB and get their actual ID
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email || '' },
    select: { id: true, email: true },
  })

  if (!dbUser) {
    return {
      status: 404,
      body: { ok: false, code: 'USER_NOT_FOUND', message: 'User not found in database' },
    }
  }

  const userId = dbUser.id

  // Message rate limiting
  try {
    checkMessageRate(userId)
  } catch (err: any) {
    // Duck-type check for RateLimitedError
    if (err && typeof err === 'object' && (err as any).name === 'RateLimitedError') {
      return {
        status: 429,
        body: {
          ok: false,
          code: 'RATE_LIMITED',
          message: (err as any).message ?? 'Rate limit exceeded',
        },
      }
    }
    throw err
  }

  // Check if user is member of the room
  const membership = await prisma.roomMember.findUnique({
    where: {
      userId_roomId: {
        userId: userId,
        roomId: roomId,
      },
    },
  })

  if (!membership) {
    return {
      status: 403,
      body: {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Not a member of this room',
      },
    }
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      roomId,
      userId: userId,
      content,
      parentMessageId: parentMessageId || null,
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

  return {
    status: 201,
    body: {
      ok: true,
      data: {
        id: message.id,
        roomId: message.roomId,
        userId: message.userId,
        user: message.user,
        content: message.content,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        deletedAt: message.deletedAt,
        reactions: message.reactions,
        parentMessageId: message.parentMessageId,
      },
    },
  }
}

