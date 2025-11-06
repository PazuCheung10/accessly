import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertRoomRole, getMembership } from '@/lib/rbac'
import { RoomRole } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/rooms/[roomId]/members
 * List room members
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

    // Check if user is a member
    const membership = await getMembership(dbUser.id, roomId, prisma)
    if (!membership) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'You must be a member to view room members',
      }, { status: 403 })
    }

    // Get all members
    const members = await prisma.roomMember.findMany({
      where: { roomId },
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
      orderBy: [
        { role: 'asc' }, // OWNER first, then MODERATOR, then MEMBER
        { id: 'asc' }, // Use id for secondary sort (CUIDs are roughly chronological)
      ],
    })

    return Response.json({
      ok: true,
      code: 'SUCCESS',
      message: 'Members retrieved successfully',
      data: {
        members: members.map((m) => ({
          id: m.id,
          role: m.role,
          user: m.user,
        })),
      },
    })
  } catch (error: any) {
    console.error('Error fetching members:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
    })
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
    }, { status: 500 })
  }
}

/**
 * DELETE /api/chat/rooms/[roomId]/members/[userId]
 * Remove a member (OWNER/MODERATOR only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string; userId: string }> }
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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'userId parameter is required',
      }, { status: 400 })
    }

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

    // Check if user has permission (OWNER or MODERATOR)
    try {
      await assertRoomRole(
        dbUser.id,
        roomId,
        [RoomRole.OWNER, RoomRole.MODERATOR],
        prisma
      )
    } catch (error: any) {
      if (error.code === 'INSUFFICIENT_MEMBERSHIP') {
        return Response.json({
          ok: false,
          code: 'FORBIDDEN',
          message: 'Only room owners and moderators can remove members',
        }, { status: 403 })
      }
      throw error
    }

    // Check if target user is a member
    const targetMembership = await getMembership(userId, roomId, prisma)
    if (!targetMembership) {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'User is not a member of this room',
      }, { status: 404 })
    }

    // Prevent removing the last OWNER
    if (targetMembership.role === RoomRole.OWNER) {
      const ownerCount = await prisma.roomMember.count({
        where: {
          roomId,
          role: RoomRole.OWNER,
        },
      })

      if (ownerCount <= 1) {
        return Response.json({
          ok: false,
          code: 'FORBIDDEN',
          message: 'Cannot remove the last owner of the room',
        }, { status: 403 })
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

    return Response.json({
      ok: true,
      code: 'SUCCESS',
      message: 'Member removed successfully',
    })
  } catch (error: any) {
    console.error('Error removing member:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

