import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/chat/rooms/[roomId]/join
 * Join a room (public rooms only, or private rooms if user has permission)
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
    })

    if (!room) {
      return Response.json({
        ok: false,
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      }, { status: 404 })
    }

    // Check if room is private (users can't join private rooms directly)
    if (room.isPrivate) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Cannot join private room. Contact an admin for access.',
      }, { status: 403 })
    }

    // Check if user is already a member
    const existingMembership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: session.user.id,
          roomId,
        },
      },
    })

    if (existingMembership) {
      return Response.json({
        ok: true,
        data: {
          message: 'Already a member of this room',
          membership: existingMembership,
        },
      })
    }

    // Add user as member
    const membership = await prisma.roomMember.create({
      data: {
        userId: session.user.id,
        roomId,
        role: 'MEMBER',
      },
    })

    return Response.json({
      ok: true,
      data: {
        membership,
        room: {
          id: room.id,
          name: room.name,
          isPrivate: room.isPrivate,
        },
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error joining room:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

