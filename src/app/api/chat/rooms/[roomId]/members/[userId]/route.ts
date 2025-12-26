import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertRoomRole, getMembership } from '@/lib/rbac'
import { RoomRole } from '@prisma/client'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/chat/rooms/[roomId]/members/[userId]
 * Remove a member from a room (owner only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string; userId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { roomId, userId } = await params

    // Get current user from DB
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!currentUser) {
      return Response.json({ ok: false, code: 'USER_NOT_FOUND' }, { status: 404 })
    }

    // Check if current user is owner (only owners can remove members)
    await assertRoomRole(currentUser.id, roomId, [RoomRole.OWNER], prisma)

    // Get target membership
    const targetMembership = await getMembership(userId, roomId, prisma)
    if (!targetMembership) {
      return Response.json({ ok: false, code: 'NOT_FOUND', message: 'User is not a member' }, { status: 404 })
    }

    // Prevent removing yourself
    if (userId === currentUser.id) {
      return Response.json(
        { ok: false, code: 'INVALID_REQUEST', message: 'Cannot remove yourself' },
        { status: 400 }
      )
    }

    // SAFEGUARD: Cannot remove last OWNER if there are other members
    if (targetMembership.role === RoomRole.OWNER) {
      const ownerCount = await prisma.roomMember.count({
        where: {
          roomId,
          role: RoomRole.OWNER,
        },
      })

      const totalMembers = await prisma.roomMember.count({
        where: { roomId },
      })

      if (ownerCount === 1 && totalMembers > 1) {
        return Response.json(
          {
            ok: false,
            code: 'INVALID_REQUEST',
            message: 'Cannot remove the last owner while other members exist. Transfer ownership first.',
          },
          { status: 400 }
        )
      }
    }

    // Remove member
    await prisma.roomMember.delete({
      where: {
        userId_roomId: {
          userId,
          roomId,
        },
      },
    })

    // Log action
    await logAction('member.remove', currentUser.id, 'member', userId, {
      roomId,
      removedRole: targetMembership.role,
    })

    return Response.json({ ok: true, data: { userId, roomId } })
  } catch (error: any) {
    if (error.code === 'INSUFFICIENT_MEMBERSHIP' || error.code === 'INSUFFICIENT_ROLE') {
      return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
    }
    console.error('Error removing member:', error)
    return Response.json({ ok: false, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

