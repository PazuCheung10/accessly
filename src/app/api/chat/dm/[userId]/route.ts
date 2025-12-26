import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoomType } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/chat/dm/:userId
 * Get or create a DM room with the specified user
 * Returns existing DM room if one exists, otherwise creates a new one
 * 
 * NOTE: DM feature is disabled - this endpoint returns 403
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
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

    // DM feature is disabled - block all DM creation
    return Response.json({
      ok: false,
      code: 'FEATURE_DISABLED',
      message: 'Direct Messages feature is currently disabled',
    }, { status: 403 })

    // Unreachable code below (DM feature disabled)
    // Kept for future re-enablement
    /* eslint-disable @typescript-eslint/no-unreachable-code */
    const { userId: targetUserId } = await params

    if (!targetUserId) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'User ID is required',
      }, { status: 400 })
    }

    // Verify current user exists in DB
    // @ts-expect-error - Unreachable code, DM feature disabled
    if (!session?.user?.email) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'User email is required',
      }, { status: 401 })
    }

    // @ts-expect-error - Unreachable code, DM feature disabled
    // @ts-expect-error - Unreachable code, DM feature disabled
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, name: true, image: true },
    })

    // @ts-expect-error - Unreachable code, DM feature disabled
    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'Current user not found in database',
      }, { status: 404 })
    }

    // @ts-expect-error - Unreachable code, DM feature disabled
    const currentUserId = dbUser.id

    // Prevent messaging yourself
    // @ts-expect-error - Unreachable code, DM feature disabled
    if (currentUserId === targetUserId) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Cannot create DM with yourself',
      }, { status: 400 })
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, name: true, image: true },
    })

    if (!targetUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'Target user not found',
      }, { status: 404 })
    }

    // Check if DM room already exists between these two users
    // DM room name pattern: dm-{userId1}-{userId2} (sorted to ensure uniqueness)
    const userIds = [currentUserId, targetUserId].sort()
    const dmRoomName = `dm-${userIds[0]}-${userIds[1]}`

    // First, try to find existing DM room by name
    let dmRoom = await prisma.room.findUnique({
      where: { name: dmRoomName },
      include: {
        members: {
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
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
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

    // If room exists, verify both users are members
    // @ts-expect-error - Unreachable code, DM feature disabled
    if (dmRoom) {
      // @ts-expect-error - Unreachable code, DM feature disabled
      const memberIds = dmRoom.members.map((m) => m.userId)
      // @ts-expect-error - Unreachable code, DM feature disabled
      const bothMembers = memberIds.includes(currentUserId) && memberIds.includes(targetUserId)

      // @ts-expect-error - Unreachable code, DM feature disabled
      if (bothMembers && dbUser) {
        // Room exists and both are members - return it
        // @ts-expect-error - Unreachable code, DM feature disabled
        const lastMessage = dmRoom.messages[0] || null
        // @ts-expect-error - Unreachable code, DM feature disabled
        const otherUser = dmRoom.members.find((m) => m.userId !== currentUserId)?.user

        return Response.json({
          ok: true,
          data: {
            room: {
              // @ts-expect-error - Unreachable code, DM feature disabled
              id: dmRoom.id,
              // @ts-expect-error - Unreachable code, DM feature disabled
              name: dmRoom.name,
              // @ts-expect-error - Unreachable code, DM feature disabled
              title: dmRoom.title,
              // @ts-expect-error - Unreachable code, DM feature disabled
              description: dmRoom.description ?? null,
              // @ts-expect-error - Unreachable code, DM feature disabled
              type: dmRoom.type,
              // @ts-expect-error - Unreachable code, DM feature disabled
              isPrivate: dmRoom.isPrivate,
              // @ts-expect-error - Unreachable code, DM feature disabled
              createdAt: dmRoom.createdAt.toISOString(),
              // @ts-expect-error - Unreachable code, DM feature disabled
              _count: dmRoom._count,
              lastMessage: lastMessage
                ? {
                    id: lastMessage.id,
                    content: lastMessage.content,
                    createdAt: lastMessage.createdAt.toISOString(),
                    user: {
                      id: lastMessage.user.id,
                      name: lastMessage.user.name,
                      image: lastMessage.user.image,
                    },
                  }
                : null,
              otherUser: otherUser
                ? {
                    id: otherUser.id,
                    name: otherUser.name,
                    email: otherUser.email,
                    image: otherUser.image,
                  }
                : null,
            },
          },
        })
      }
    }

    // Room doesn't exist or one user is missing - create new DM room
    // Ensure both users are added as members
    // @ts-expect-error - Unreachable code, DM feature disabled
    if (!dbUser || !targetUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      }, { status: 404 })
    }

    // @ts-expect-error - Unreachable code, DM feature disabled
    const newDmRoom = await prisma.room.create({
      data: {
        name: dmRoomName,
        title: `DM: ${dbUser.name || dbUser.email} & ${targetUser.name || targetUser.email}`,
        description: null,
        type: RoomType.DM,
        isPrivate: true,
        creatorId: currentUserId,
        tags: [],
        members: {
          create: [
            {
              userId: currentUserId,
              role: 'MEMBER',
            },
            {
              userId: targetUserId,
              role: 'MEMBER',
            },
          ],
        },
      },
      include: {
        members: {
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
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    })

    // @ts-expect-error - Unreachable code, DM feature disabled
    const otherUser = newDmRoom.members.find((m) => m.userId !== currentUserId)?.user

    return Response.json({
      ok: true,
      data: {
        room: {
          // @ts-expect-error - Unreachable code, DM feature disabled
          id: newDmRoom.id,
          // @ts-expect-error - Unreachable code, DM feature disabled
          name: newDmRoom.name,
          // @ts-expect-error - Unreachable code, DM feature disabled
          title: newDmRoom.title,
          // @ts-expect-error - Unreachable code, DM feature disabled
          description: newDmRoom.description,
          // @ts-expect-error - Unreachable code, DM feature disabled
          type: newDmRoom.type,
          // @ts-expect-error - Unreachable code, DM feature disabled
          isPrivate: newDmRoom.isPrivate,
          // @ts-expect-error - Unreachable code, DM feature disabled
          createdAt: newDmRoom.createdAt.toISOString(),
          // @ts-expect-error - Unreachable code, DM feature disabled
          _count: newDmRoom._count,
          lastMessage: null,
          otherUser: otherUser
            ? {
                id: otherUser.id,
                name: otherUser.name,
                email: otherUser.email,
                image: otherUser.image,
              }
            : null,
        },
      },
    })
  } catch (error: any) {
    console.error('Error in POST /api/chat/dm/[userId]:', error)
    return Response.json(
      {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

