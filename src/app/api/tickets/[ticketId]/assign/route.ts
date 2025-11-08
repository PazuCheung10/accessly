import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, RoomRole } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/tickets/[ticketId]/assign
 * Assign ticket to another admin (admin only)
 */
export async function POST(
  request: Request,
  { params }: { params: { ticketId: string } }
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

    const { ticketId } = params
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
      select: { type: true },
    })

    if (!ticket || ticket.type !== RoomType.TICKET) {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Ticket not found',
      }, { status: 404 })
    }

    // Verify assignee is an admin
    const assignee = await prisma.user.findUnique({
      where: { id: assignToUserId },
      select: { id: true, role: true },
    })

    if (!assignee || assignee.role !== Role.ADMIN) {
      return Response.json({
        ok: false,
        code: 'INVALID_ASSIGNEE',
        message: 'Can only assign to admins',
      }, { status: 400 })
    }

    // Get current owner
    const currentOwner = await prisma.roomMember.findFirst({
      where: {
        roomId: ticketId,
        role: RoomRole.OWNER,
      },
    })

    // Remove current owner's OWNER role (make them MODERATOR)
    if (currentOwner) {
      await prisma.roomMember.update({
        where: { id: currentOwner.id },
        data: { role: RoomRole.MODERATOR },
      })
    }

    // Check if assignee is already a member
    const existingMember = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: assignToUserId,
          roomId: ticketId,
        },
      },
    })

    if (existingMember) {
      // Update to OWNER
      await prisma.roomMember.update({
        where: { id: existingMember.id },
        data: { role: RoomRole.OWNER },
      })
    } else {
      // Add as OWNER
      await prisma.roomMember.create({
        data: {
          userId: assignToUserId,
          roomId: ticketId,
          role: RoomRole.OWNER,
        },
      })
    }

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

