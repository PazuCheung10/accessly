import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMembership } from '@/lib/rbac'
import { RoomRole } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/rooms/[roomId]
 * Get room details with membership info
 */
export async function GET(
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

    // Verify user exists in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Get room with full details
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        title: true,
        description: true,
        tags: true,
        type: true,
        isPrivate: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    })

    if (!room) {
      return Response.json({
        ok: false,
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      }, { status: 404 })
    }

    // Get user's membership
    const membership = await getMembership(dbUser.id, roomId, prisma)

    // Check if user has access (must be member for private rooms)
    if (room.type === 'PRIVATE' && !membership) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'You do not have access to this room',
      }, { status: 403 })
    }

    return Response.json({
      ok: true,
      code: 'SUCCESS',
      message: 'Room retrieved successfully',
      data: {
        room: {
          ...room,
          userRole: membership?.role || null,
          isMember: !!membership,
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching room:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

/**
 * PATCH /api/chat/rooms/[roomId]
 * Update room metadata (only OWNER)
 */
export async function PATCH(
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

    // Verify user exists in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Check if user is OWNER
    const membership = await getMembership(dbUser.id, roomId, prisma)
    if (!membership || membership.role !== RoomRole.OWNER) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Only room owners can update room metadata',
      }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, tags } = body

    // Update room
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(tags !== undefined && { tags }),
      },
      select: {
        id: true,
        name: true,
        title: true,
        description: true,
        tags: true,
        type: true,
        isPrivate: true,
      },
    })

    return Response.json({
      ok: true,
      code: 'SUCCESS',
      message: 'Room updated successfully',
      data: {
        room: updatedRoom,
      },
    })
  } catch (error: any) {
    console.error('Error updating room:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

