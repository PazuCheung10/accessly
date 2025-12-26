import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, RoomRole } from '@prisma/client'
import { logAction } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/tickets/[ticketId]/assign
 * Assign ticket to a user (admin only)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
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

    // Verify user is admin
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, role: true },
    })

    if (!dbUser || dbUser.role !== Role.ADMIN) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Admin access required',
      }, { status: 403 })
    }

    const { ticketId } = await params
    const body = await request.json()
    const { assignToUserId } = body

    if (!assignToUserId) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'assignToUserId is required',
      }, { status: 400 })
    }

    // Verify ticket exists and is a TICKET type
    const ticket = await prisma.room.findUnique({
      where: { id: ticketId },
      select: { type: true, title: true },
    })

    if (!ticket || ticket.type !== 'TICKET') {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Ticket not found',
      }, { status: 404 })
    }

    // Verify assignee exists (any role is allowed)
    const assignee = await prisma.user.findUnique({
      where: { id: assignToUserId },
      select: { id: true, role: true, name: true, email: true },
    })

    if (!assignee) {
      return Response.json({
        ok: false,
        code: 'INVALID_ASSIGNEE',
        message: 'Assignee not found',
      }, { status: 400 })
    }

    // Get current owner and existing member status in a single transaction
    const [currentOwner, existingMember] = await Promise.all([
      prisma.roomMember.findFirst({
        where: {
          roomId: ticketId,
          role: RoomRole.OWNER,
        },
      }),
      prisma.roomMember.findUnique({
        where: {
          userId_roomId: {
            userId: assignToUserId,
            roomId: ticketId,
          },
        },
      }),
    ])

    // Prevent assigning to the current owner (no-op case)
    if (currentOwner && currentOwner.userId === assignToUserId) {
      return Response.json({
        ok: true,
        data: {
          ticketId,
          assignedTo: assignee.id,
        },
      })
    }

    // Perform owner swap in a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Step 1: Demote current owner to MODERATOR (if exists and not the assignee)
      if (currentOwner && currentOwner.userId !== assignToUserId) {
        await tx.roomMember.update({
          where: { id: currentOwner.id },
          data: { role: RoomRole.MODERATOR },
        })
      }

      // Step 2: Ensure no other OWNERs exist (safety check - update any other OWNERs to MODERATOR)
      await tx.roomMember.updateMany({
        where: {
          roomId: ticketId,
          role: RoomRole.OWNER,
          userId: { not: assignToUserId },
        },
        data: { role: RoomRole.MODERATOR },
      })

      // Step 3: Make assignee the OWNER
      if (existingMember) {
        // Update existing member to OWNER
        await tx.roomMember.update({
          where: { id: existingMember.id },
          data: { role: RoomRole.OWNER },
        })
      } else {
        // Create new membership as OWNER
        await tx.roomMember.create({
          data: {
            userId: assignToUserId,
            roomId: ticketId,
            role: RoomRole.OWNER,
          },
        })
      }
    })

    // Log audit action
    await logAction('ticket.assign', dbUser.id, 'room', ticketId, {
      assignedToUserId: assignee.id,
      assignedToName: assignee.name || assignee.email || 'Unknown',
      ticketTitle: ticket.title,
      previousOwnerId: currentOwner?.userId || null,
    })

    return Response.json({
      ok: true,
      data: {
        ticketId,
        assignedTo: assignee.id,
      },
    })
  } catch (error: any) {
    console.error('Error assigning ticket:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

