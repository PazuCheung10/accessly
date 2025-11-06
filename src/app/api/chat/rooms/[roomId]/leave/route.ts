import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertMembership, getMembership } from '@/lib/rbac'
import { RoomRole } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/chat/rooms/[roomId]/leave
 * Leave a room (cannot leave if you're the only OWNER with members)
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
      },
    })

    if (!room) {
      return Response.json({
        ok: false,
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      }, { status: 404 })
    }

    // Check if user is a member
    try {
      await assertMembership(session.user.id, roomId, prisma)
    } catch (error: any) {
      if (error.code === 'INSUFFICIENT_MEMBERSHIP') {
        return Response.json({
          ok: false,
          code: 'NOT_MEMBER',
          message: 'Not a member of this room',
        }, { status: 403 })
      }
      throw error
    }

    // Get user's membership
    const membership = await getMembership(session.user.id, roomId, prisma)
    if (!membership) {
      return Response.json({
        ok: false,
        code: 'NOT_MEMBER',
        message: 'Not a member of this room',
      }, { status: 403 })
    }

    // If user is OWNER, check if they're the only owner with other members
    if (membership.role === RoomRole.OWNER) {
      // Count owners and total members
      const ownerCount = await prisma.roomMember.count({
        where: {
          roomId,
          role: RoomRole.OWNER,
        },
      })

      const totalMembers = await prisma.roomMember.count({
        where: { roomId },
      })

      // Cannot leave if you're the only owner and there are other members
      if (ownerCount === 1 && totalMembers > 1) {
        return Response.json({
          ok: false,
          code: 'CANNOT_LEAVE',
          message: 'Cannot leave room: you are the only owner with other members. Transfer ownership or remove members first.',
        }, { status: 400 })
      }
    }

    // Remove membership
    await prisma.roomMember.delete({
      where: {
        userId_roomId: {
          userId: session.user.id,
          roomId,
        },
      },
    })

    return Response.json({
      ok: true,
      code: 'LEFT',
      message: 'Successfully left room',
      data: {
        room: {
          id: room.id,
          name: room.name,
          title: room.title,
        },
      },
    })
  } catch (error: any) {
    console.error('Error leaving room:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

