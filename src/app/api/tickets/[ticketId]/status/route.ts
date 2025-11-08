import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, TicketStatus } from '@prisma/client'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const StatusInput = z.object({
  status: z.enum(['OPEN', 'WAITING', 'RESOLVED']),
})

/**
 * PATCH /api/tickets/[ticketId]/status
 * Update ticket status (admin only)
 */
export async function PATCH(
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

    // Validate input
    const validated = StatusInput.safeParse(body)
    if (!validated.success) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid status input',
        details: validated.error.errors,
      }, { status: 400 })
    }

    // Verify ticket exists and is a TICKET type
    const ticket = await prisma.room.findUnique({
      where: { id: ticketId },
      select: { type: true },
    })

    if (!ticket || ticket.type !== 'TICKET') {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Ticket not found',
      }, { status: 404 })
    }

    // Update status
    const updated = await prisma.room.update({
      where: { id: ticketId },
      data: {
        status: validated.data.status as TicketStatus,
      },
      select: {
        id: true,
        status: true,
      },
    })

    return Response.json({
      ok: true,
      data: {
        ticketId: updated.id,
        status: updated.status,
      },
    })
  } catch (error: any) {
    console.error('Error updating ticket status:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

