import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertRole } from '@/lib/rbac'
import { Role } from '@prisma/client'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DeleteRoomInput = z.object({
  confirm: z.literal(true),
})

/**
 * DELETE /api/admin/rooms/[roomId]
 * Delete a room (admin only, with confirmation)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })
    }

    assertRole(session, Role.ADMIN)

    const { roomId } = await params
    const body = await request.json()
    const validated = DeleteRoomInput.parse(body)

    if (!validated.confirm) {
      return Response.json(
        { ok: false, code: 'VALIDATION_ERROR', message: 'Confirmation required' },
        { status: 400 }
      )
    }

    // Get admin user from DB
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!adminUser) {
      return Response.json({ ok: false, code: 'USER_NOT_FOUND' }, { status: 404 })
    }

    // Check if room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    })

    if (!room) {
      return Response.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
    }

    // Delete room (cascade will handle members and messages)
    await prisma.room.delete({
      where: { id: roomId },
    })

    // Log action
    await logAction('room.delete', adminUser.id, 'room', roomId, {
      roomName: room.name,
      memberCount: room._count.members,
      messageCount: room._count.messages,
    })

    return Response.json({ ok: true, data: { roomId } })
  } catch (error: any) {
    if (error.code === 'INSUFFICIENT_ROLE') {
      return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
    }
    if (error.name === 'ZodError') {
      return Response.json({ ok: false, code: 'VALIDATION_ERROR', details: error.errors }, { status: 400 })
    }
    console.error('Error deleting room:', error)
    return Response.json({ ok: false, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

