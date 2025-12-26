import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertRoomRole } from '@/lib/rbac'
import { RoomRole, RoomType } from '@prisma/client'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UpdateRoomSettingsInput = z.object({
  tags: z.array(z.string()).optional(),
  type: z.nativeEnum(RoomType).optional(),
})

/**
 * PATCH /api/chat/rooms/[roomId]/settings
 * Update room settings (tags, type) - owner/mod only
 */
export async function PATCH(
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
    const validated = UpdateRoomSettingsInput.parse(body)

    // Get current user from DB
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!currentUser) {
      return Response.json({ ok: false, code: 'USER_NOT_FOUND' }, { status: 404 })
    }

    // Check if current user is owner or moderator
    await assertRoomRole(currentUser.id, roomId, [RoomRole.OWNER, RoomRole.MODERATOR], prisma)

    // Get current room settings
    const currentRoom = await prisma.room.findUnique({
      where: { id: roomId },
      select: { tags: true, type: true, name: true },
    })

    if (!currentRoom) {
      return Response.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}
    if (validated.tags !== undefined) {
      updateData.tags = validated.tags
    }
    if (validated.type !== undefined) {
      updateData.type = validated.type
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ ok: false, code: 'VALIDATION_ERROR', message: 'No fields to update' }, { status: 400 })
    }

    // Update room
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: updateData,
      select: { id: true, tags: true, type: true },
    })

    // Log action
    await logAction('room.edit', currentUser.id, 'room', roomId, {
      oldTags: currentRoom.tags,
      newTags: updatedRoom.tags,
      oldType: currentRoom.type,
      newType: updatedRoom.type,
    })

    return Response.json({ ok: true, data: { room: updatedRoom } })
  } catch (error: any) {
    if (error.code === 'INSUFFICIENT_MEMBERSHIP' || error.code === 'INSUFFICIENT_ROLE') {
      return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
    }
    if (error.name === 'ZodError') {
      return Response.json({ ok: false, code: 'VALIDATION_ERROR', details: error.errors }, { status: 400 })
    }
    console.error('Error updating room settings:', error)
    return Response.json({ ok: false, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

