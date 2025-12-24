import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getMembership } from '@/lib/rbac'
import { logAction } from '@/lib/audit'
import { isExternalCustomer } from '@/lib/user-utils'
import { RoomRole, Role, RoomType } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/rooms/[roomId]
 * Get room details with membership info
 */
export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
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

    const { roomId } = params

    // Verify user exists in DB and get their role and department
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, role: true, department: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Get room with full details including department
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        title: true,
        description: true,
        tags: true,
        type: true,
        status: true,
        ticketDepartment: true,
        department: true,
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
        members: {
          where: {
            role: 'OWNER',
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

    // Check if user is external customer
    const userIsExternal = await isExternalCustomer(dbUser.id)
    const isAdmin = dbUser.role === Role.ADMIN

    // Check if user has access based on room type
    if (room.type === RoomType.PRIVATE) {
      // PRIVATE rooms: must be a member
      if (!membership) {
        return Response.json({
          ok: false,
          code: 'FORBIDDEN',
          message: 'You do not have access to this room',
        }, { status: 403 })
      }
    } else if (room.type === RoomType.TICKET) {
      // TICKET rooms: 
      // - External customers: must be a member (no admin override)
      // - Internal users/admins: must be a member OR be an ADMIN
      if (userIsExternal) {
        // External customers can only access their own tickets
        if (!membership) {
          return Response.json({
            ok: false,
            code: 'FORBIDDEN',
            message: 'You do not have access to this ticket',
          }, { status: 403 })
        }
      } else {
        // Internal users/admins: must be a member OR be an ADMIN
        if (!membership && !isAdmin) {
          return Response.json({
            ok: false,
            code: 'FORBIDDEN',
            message: 'You do not have access to this ticket',
          }, { status: 403 })
        }
      }
    } else if (room.type === RoomType.PUBLIC) {
      // PUBLIC rooms: check department-based access
      if (userIsExternal) {
        // External customers cannot access any PUBLIC rooms
        return Response.json({
          ok: false,
          code: 'FORBIDDEN',
          message: 'External customers cannot access internal rooms',
        }, { status: 403 })
      }
      
      if (!isAdmin) {
        // Non-admin internal users: must match department or be PUBLIC_GLOBAL
        if (room.department !== null && room.department !== dbUser.department) {
          return Response.json({
            ok: false,
            code: 'FORBIDDEN',
            message: 'You do not have access to rooms from other departments',
          }, { status: 403 })
        }
      }
      // Admins can access all PUBLIC rooms (no check needed)
    }

    // For TICKET rooms, calculate response metrics
    let lastResponder = null
    let averageResponseTime = null

    if (room.type === 'TICKET') {
      // Get all messages ordered by creation time
      const messages = await prisma.message.findMany({
        where: { roomId },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      })

      if (messages.length > 0) {
        // Last responder is the user of the last message
        const lastMessage = messages[messages.length - 1]
        lastResponder = {
          id: lastMessage.user.id,
          name: lastMessage.user.name,
          email: lastMessage.user.email,
        }

        // Calculate average response time
        // Response time = time between customer message and admin response
        const responseTimes: number[] = []
        let lastCustomerMessageTime: Date | null = null

        for (const msg of messages) {
          // Check if message is from a customer (not an admin/owner)
          const msgMember = await prisma.roomMember.findUnique({
            where: {
              userId_roomId: {
                userId: msg.userId,
                roomId,
              },
            },
            select: { role: true },
          })

          const isAdminResponse = msgMember?.role === 'OWNER' || msgMember?.role === 'MODERATOR'

          if (!isAdminResponse) {
            // Customer message - mark as start of response window
            lastCustomerMessageTime = msg.createdAt
          } else if (lastCustomerMessageTime) {
            // Admin response - calculate time since last customer message
            const responseTime = msg.createdAt.getTime() - lastCustomerMessageTime.getTime()
            responseTimes.push(responseTime)
            lastCustomerMessageTime = null
          }
        }

        if (responseTimes.length > 0) {
          const totalResponseTime = responseTimes.reduce((sum, time) => sum + time, 0)
          averageResponseTime = Math.round(totalResponseTime / responseTimes.length / 1000 / 60) // Convert to minutes
        }
      }
    }

    // For TICKET rooms, admins are considered "members" for access purposes
    const isAdminForTicket = room.type === 'TICKET' && dbUser.role === Role.ADMIN
    const effectiveIsMember = !!membership || isAdminForTicket

    return Response.json({
      ok: true,
      code: 'SUCCESS',
      message: 'Room retrieved successfully',
      data: {
        room: {
          ...room,
          userRole: membership?.role || null,
          isMember: effectiveIsMember,
          isAdmin: isAdmin, // Include admin status for UI decisions
          owner: room.members[0]?.user || null,
          lastResponder,
          averageResponseTime,
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

    // Get current room data for diff
    const currentRoom = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        title: true,
        description: true,
        tags: true,
      },
    })

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

    // Log audit action with diff
    if (currentRoom) {
      const diff: any = {}
      if (title !== undefined && title !== currentRoom.title) {
        diff.title = { old: currentRoom.title, new: title }
      }
      if (description !== undefined && description !== currentRoom.description) {
        diff.description = { old: currentRoom.description, new: description }
      }
      if (tags !== undefined && JSON.stringify(tags) !== JSON.stringify(currentRoom.tags)) {
        diff.tags = { old: currentRoom.tags, new: tags }
      }

      if (Object.keys(diff).length > 0) {
        await logAction('room.edit', dbUser.id, 'room', roomId, diff)
      }
    }

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

