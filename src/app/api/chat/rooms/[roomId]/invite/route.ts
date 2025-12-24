import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
 * Creator/moderator can add user to private room or ticket room
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

    // Public room → 403 FORBIDDEN (test expects this)
    // Allow PRIVATE and TICKET rooms (both are invite-only)
    if (room.type === RoomType.PUBLIC) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Can only invite users to private rooms or tickets. Public rooms can be joined directly.',
      }, { status: 403 })
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

    const inviterMembership = await prisma.roomMember.findFirst({
      where: {
        roomId,
        userId: session.user.id,
      },
    })

    // Not a member → 403 NOT_MEMBER
    if (!inviterMembership) {
      return Response.json({
        ok: false,
        code: 'NOT_MEMBER',
        message: 'Not a member of this room',
      }, { status: 403 })
    }

    // MEMBER cannot invite → 403 FORBIDDEN
    if (inviterMembership.role === RoomRole.MEMBER) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Only room creators and moderators can invite users',
      }, { status: 403 })
    }

    // OWNER or MODERATOR continue...

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

    const existing = await prisma.roomMember.findFirst({
      where: {
        roomId,
        userId: validated.data.userId,
      },
    })

    if (existing) {
      return Response.json({
        ok: true,
        code: 'ALREADY_MEMBER',
        message: 'User is already a member of this room',
        data: {
          membership: existing,
        },
      }, { status: 200 })
    }

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

    // Must be 201, not 200
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
