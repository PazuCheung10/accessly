import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertRoomRole, getMembership } from '@/lib/rbac'
import { RoomRole, Role } from '@prisma/client'
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
      select: { id: true, role: true },
    })

    if (!currentUser) {
      return Response.json({ ok: false, code: 'USER_NOT_FOUND' }, { status: 404 })
    }

    const isAdmin = currentUser.role === Role.ADMIN

    // Check if current user is owner or admin (both can transfer ownership)
    if (!isAdmin) {
      await assertRoomRole(currentUser.id, roomId, [RoomRole.OWNER], prisma)
    }

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

    // Find current owner(s) - there should only be one, but handle multiple for safety
    const currentOwners = await prisma.roomMember.findMany({
      where: {
        roomId,
        role: RoomRole.OWNER,
      },
    })

    // Transfer ownership in a transaction
    await prisma.$transaction(async (tx) => {
      // Demote all current owners to moderator (except the new owner)
      for (const owner of currentOwners) {
        if (owner.userId !== validated.newOwnerId) {
          await tx.roomMember.update({
            where: { id: owner.id },
            data: { role: RoomRole.MODERATOR },
          })
        }
      }

      // Promote new owner
      const newOwnerMembership = await getMembership(validated.newOwnerId, roomId, prisma)
      if (newOwnerMembership) {
        await tx.roomMember.update({
          where: {
            userId_roomId: {
              userId: validated.newOwnerId,
              roomId,
            },
          },
          data: { role: RoomRole.OWNER },
        })
      } else {
        // If new owner is not a member, create membership as OWNER
        await tx.roomMember.create({
          data: {
            userId: validated.newOwnerId,
            roomId,
            role: RoomRole.OWNER,
          },
        })
      }
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

