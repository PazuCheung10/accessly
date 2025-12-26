import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/io'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ReactionInput = z.object({
  emoji: z.string().min(1).max(10), // Emoji character(s)
})

/**
 * POST /api/chat/messages/[messageId]/reactions
 * Toggle a reaction on a message
 */
export async function POST(
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
    const validated = ReactionInput.safeParse(body)
    if (!validated.success || !validated.data.emoji.trim()) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid emoji',
        details: validated.success ? undefined : validated.error.errors,
      }, { status: 400 })
    }

    // Verify the user exists in DB
    // Use email for lookup (consistent with other routes)
    if (!session.user.email) {
      return Response.json({
        ok: false,
        code: 'MISSING_EMAIL',
        message: 'User email is required',
      }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    const emoji = validated.data.emoji.trim()
    const userId = dbUser.id

    // Use transaction for safe read-modify-write pattern
    const updated = await prisma.$transaction(async (tx: typeof prisma) => {
      // 1) Read current message and reactions
      const message = await tx.message.findUnique({
        where: { id: messageId },
        select: { 
          id: true,
          roomId: true,
          deletedAt: true,
          reactions: true,
        },
      })

      if (!message) {
        throw new Error('NOT_FOUND')
      }

      // Check if message is deleted
      if (message.deletedAt) {
        throw new Error('FORBIDDEN')
      }

      // 2) Normalize current reactions structure
      type ReactionsMap = Record<string, string[]>
      const current: ReactionsMap = (message.reactions as ReactionsMap) ?? {}

      // 3) Remove user from all other emoji reactions (one reaction per user)
      const next: ReactionsMap = { ...current }
      
      // First, remove user from all existing reactions
      for (const [existingEmoji, userIds] of Object.entries(next)) {
        const filtered = userIds.filter(id => id !== userId)
        if (filtered.length === 0) {
          delete next[existingEmoji]
        } else {
          next[existingEmoji] = filtered
        }
      }

      // 4) Check if user already has this emoji (toggle behavior)
      const hasThisEmoji = current[emoji]?.includes(userId) ?? false

      if (hasThisEmoji) {
        // User is toggling off - already removed above, just clean up
        // (next[emoji] is already filtered without userId, or deleted if empty)
      } else {
        // User is adding this emoji - add them
        if (!next[emoji]) {
          next[emoji] = []
        }
        // Use Set to prevent duplicates (defensive)
        const userIdsSet = new Set(next[emoji])
        userIdsSet.add(userId)
        next[emoji] = Array.from(userIdsSet)
      }

      // 5) Clean up: remove empty arrays to keep JSON small
      const cleaned: ReactionsMap = {}
      for (const [e, users] of Object.entries(next)) {
        if (users.length > 0) {
          cleaned[e] = users
        }
      }

      // 6) Write whole JSON back (or null if empty)
      const reactionsValue = Object.keys(cleaned).length > 0 ? cleaned : null

      return tx.message.update({
        where: { id: messageId },
        data: { reactions: reactionsValue },
        select: { 
          id: true,
          roomId: true,
          reactions: true,
        },
      })
    })

    // 7) Emit socket event for real-time updates
    const io = getIO()
    if (io) {
      const reactionsMap = (updated.reactions as Record<string, string[]>) ?? {}
      io.to(updated.roomId).emit('message:reaction', {
        id: updated.id,
        roomId: updated.roomId,
        reactions: reactionsMap,
      })
    }

    // 8) Return response
    const reactionsMap = (updated.reactions as Record<string, string[]>) ?? {}
    return Response.json({
      ok: true,
      data: {
        messageId: updated.id,
        reactions: reactionsMap,
      },
    })
  } catch (error: any) {
    console.error('Error toggling reaction:', error)
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    if (error.stack) {
      console.error('Error stack:', error.stack)
    }

    // Handle specific error cases
    if (error.message === 'NOT_FOUND') {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Message not found',
      }, { status: 404 })
    }

    if (error.message === 'FORBIDDEN') {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Cannot react to deleted message',
      }, { status: 403 })
    }
    
    // Check if it's a database schema error (migration not applied)
    const errorMessage = error.message || ''
    if (errorMessage.includes('Unknown column') || 
        errorMessage.includes('column') || 
        errorMessage.includes('does not exist') ||
        errorMessage.includes('Unknown argument') ||
        error.code === 'P2001' ||
        error.code === 'P2025') {
      return Response.json({
        ok: false,
        code: 'SCHEMA_ERROR',
        message: 'Database migration not applied. Please run: pnpm prisma migrate deploy --schema=src/prisma/schema.prisma',
        details: error.message,
      }, { status: 500 })
    }
    
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 })
  }
}

