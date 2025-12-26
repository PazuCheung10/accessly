import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertRoomRole, getMembership } from '@/lib/rbac'
import { RoomRole } from '@prisma/client'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TransferOwnershipInput = z.object({
  newOwnerId: z.string(),
})

/**
 * POST /api/chat/rooms/[roomId]/ownership
 * Transfer room ownership (owner only)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { roomId } = await params
    const body = await request.json()
    const validated = TransferOwnershipInput.parse(body)

    // Get current user from DB
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!currentUser) {
      return Response.json({ ok: false, code: 'USER_NOT_FOUND' }, { status: 404 })
    }

    // Check if current user is owner
    await assertRoomRole(currentUser.id, roomId, [RoomRole.OWNER], prisma)

    // Check if new owner is a member
    const newOwnerMembership = await getMembership(validated.newOwnerId, roomId, prisma)
    if (!newOwnerMembership) {
      return Response.json(
        { ok: false, code: 'NOT_FOUND', message: 'Target user is not a member of this room' },
        { status: 404 }
      )
    }

    // Prevent transferring to yourself
    if (validated.newOwnerId === currentUser.id) {
      return Response.json(
        { ok: false, code: 'INVALID_REQUEST', message: 'You are already the owner' },
        { status: 400 }
      )
    }

    // Transfer ownership in a transaction
    await prisma.$transaction(async (tx) => {
      // Demote current owner to moderator
      await tx.roomMember.update({
        where: {
          userId_roomId: {
            userId: currentUser.id,
            roomId,
          },
        },
        data: { role: RoomRole.MODERATOR },
      })

      // Promote new owner
      await tx.roomMember.update({
        where: {
          userId_roomId: {
            userId: validated.newOwnerId,
            roomId,
          },
        },
        data: { role: RoomRole.OWNER },
      })
    })

    // Log action
    await logAction('ownership.transfer', currentUser.id, 'member', validated.newOwnerId, {
      roomId,
      previousOwnerId: currentUser.id,
    })

    return Response.json({ ok: true, data: { roomId, newOwnerId: validated.newOwnerId } })
  } catch (error: any) {
    if (error.code === 'INSUFFICIENT_MEMBERSHIP' || error.code === 'INSUFFICIENT_ROLE') {
      return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
    }
    if (error.name === 'ZodError') {
      return Response.json({ ok: false, code: 'VALIDATION_ERROR', details: error.errors }, { status: 400 })
    }
    console.error('Error transferring ownership:', error)
    return Response.json({ ok: false, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

