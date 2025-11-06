import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertRoomRole, getMembership } from '@/lib/rbac'
import { RoomRole, RoomType } from '@prisma/client'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const InviteInput = z.object({
  userId: z.string().cuid(),
  role: z.enum(['MEMBER', 'MODERATOR']).default('MEMBER'),
})

/**
 * POST /api/chat/rooms/[roomId]/invite
 * Creator/moderator can add user to private room
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
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

    const { roomId } = await params

    // Check if room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        title: true,
        type: true,
        isPrivate: true,
      },
    })

    if (!room) {
      return Response.json({
        ok: false,
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      }, { status: 404 })
    }

    // Only allow inviting to private rooms
    if (room.type !== RoomType.PRIVATE && !room.isPrivate) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Can only invite users to private rooms. Public rooms can be joined directly.',
      }, { status: 403 })
    }

    // Check if user has permission (OWNER or MODERATOR)
    try {
      await assertRoomRole(
        session.user.id,
        roomId,
        [RoomRole.OWNER, RoomRole.MODERATOR],
        prisma
      )
    } catch (error: any) {
      if (error.code === 'INSUFFICIENT_MEMBERSHIP') {
        return Response.json({
          ok: false,
          code: 'FORBIDDEN',
          message: 'Only room creators and moderators can invite users',
        }, { status: 403 })
      }
      throw error
    }

    const body = await request.json()

    // Validate input
    const validated = InviteInput.safeParse(body)
    if (!validated.success) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid invite input',
        details: validated.error.errors,
      }, { status: 400 })
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: validated.data.userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!targetUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      }, { status: 404 })
    }

    // Check if user is already a member
    const existingMembership = await getMembership(validated.data.userId, roomId, prisma)
    if (existingMembership) {
      return Response.json({
        ok: true,
        code: 'ALREADY_MEMBER',
        message: 'User is already a member of this room',
        data: {
          membership: existingMembership,
        },
      })
    }

    // Add user as member
    const membership = await prisma.roomMember.create({
      data: {
        userId: validated.data.userId,
        roomId,
        role: validated.data.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    return Response.json({
      ok: true,
      code: 'INVITED',
      message: 'User successfully invited to room',
      data: {
        membership,
        room: {
          id: room.id,
          name: room.name,
          title: room.title,
        },
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error inviting user:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

