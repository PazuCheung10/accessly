import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/io'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EditMessageInput = z.object({
  content: z.string().min(1).max(5000),
})

/**
 * PATCH /api/chat/messages/[messageId]
 * Edit a message (only author, within 10 minutes)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      }, { status: 401 })
    }

    const { messageId } = await params
    const body = await request.json()

    // Validate input
    const validated = EditMessageInput.safeParse(body)
    if (!validated.success) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid message input',
        details: validated.error.errors,
      }, { status: 400 })
    }

    // Verify the user exists in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Get the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
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

    if (!message) {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Message not found',
      }, { status: 404 })
    }

    // Check if user is the author
    if (message.userId !== dbUser.id) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Only the author can edit this message',
      }, { status: 403 })
    }

    // Check if message is deleted
    if (message.deletedAt) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Cannot edit deleted message',
      }, { status: 403 })
    }

    // Check if within 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    if (message.createdAt < tenMinutesAgo) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Message can only be edited within 10 minutes',
      }, { status: 403 })
    }

    // Update message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: validated.data.content,
        editedAt: new Date(),
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

    // Emit socket event
    const io = getIO()
    if (io) {
      io.to(message.roomId).emit('message:edit', {
        id: updatedMessage.id,
        roomId: updatedMessage.roomId,
        content: updatedMessage.content,
        editedAt: updatedMessage.editedAt?.toISOString(),
      })
    }

    return Response.json({
      ok: true,
      data: updatedMessage,
    })
  } catch (error: any) {
    console.error('Error editing message:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

/**
 * DELETE /api/chat/messages/[messageId]
 * Delete a message (only author, soft delete)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      }, { status: 401 })
    }

    const { messageId } = await params

    // Verify the user exists in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Get the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Message not found',
      }, { status: 404 })
    }

    // Check if user is the author
    if (message.userId !== dbUser.id) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Only the author can delete this message',
      }, { status: 403 })
    }

    // Check if already deleted
    if (message.deletedAt) {
      return Response.json({
        ok: false,
        code: 'ALREADY_DELETED',
        message: 'Message already deleted',
      }, { status: 400 })
    }

    // Soft delete message
    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: '[Message deleted]', // Replace content
      },
    })

    // Emit socket event
    const io = getIO()
    if (io) {
      io.to(message.roomId).emit('message:delete', {
        id: deletedMessage.id,
        roomId: deletedMessage.roomId,
        deletedAt: deletedMessage.deletedAt.toISOString(),
      })
    }

    return Response.json({
      ok: true,
      data: deletedMessage,
    })
  } catch (error: any) {
    console.error('Error deleting message:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

