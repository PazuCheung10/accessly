import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, RoomType, TicketStatus, TicketDepartment } from '@prisma/client'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateTicketInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  department: z.enum(['IT_SUPPORT', 'BILLING', 'PRODUCT', 'GENERAL']).optional().nullable(),
  assignToUserId: z.string().optional().nullable(),
})

/**
 * GET /api/tickets
 * List all tickets (admin only)
 */
export async function GET(request: Request) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'OPEN' | 'WAITING' | 'RESOLVED' | null

    // Fetch all tickets
    const where: any = {
      type: 'TICKET',
    }

    if (status) {
      where.status = status
    }

    const tickets = await prisma.room.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Get the last message (most recent)
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return Response.json({
      ok: true,
      data: {
        tickets: tickets.map((ticket) => ({
          id: ticket.id, // This IS the room.id (tickets are Room records with type='TICKET')
          roomId: ticket.id, // Explicitly include roomId for clarity (same as id)
          name: ticket.name,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          department: ticket.ticketDepartment,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          creator: ticket.creator,
          owner: ticket.members.find((m) => m.role === 'OWNER')?.user,
          lastMessage: ticket.messages[0] ? {
            id: ticket.messages[0].id,
            content: ticket.messages[0].content,
            createdAt: ticket.messages[0].createdAt.toISOString(),
            user: ticket.messages[0].user,
          } : null,
          messageCount: ticket._count.messages,
        })),
      },
    })
  } catch (error: any) {
    console.error('Error fetching tickets:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

/**
 * POST /api/tickets
 * Create a new issue (admin only)
 */
export async function POST(request: Request) {
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

    const body = await request.json()
    const validated = CreateTicketInput.safeParse(body)

    if (!validated.success) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: validated.error.errors,
      }, { status: 400 })
    }

    const { title, description, department, assignToUserId } = validated.data

    // If assignee specified, verify they exist (any role is allowed)
    let assigneeId = dbUser.id // Default: self-assign
    if (assignToUserId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignToUserId },
        select: { id: true, role: true },
      })

      if (!assignee) {
        return Response.json({
          ok: false,
          code: 'INVALID_ASSIGNEE',
          message: 'Assignee not found',
        }, { status: 400 })
      }
      assigneeId = assignee.id
    }

    // Generate unique room name for ticket
    const ticketName = `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Format department label for title
    const departmentLabels: Record<string, string> = {
      IT_SUPPORT: 'IT Support',
      BILLING: 'Billing',
      PRODUCT: 'Product',
      GENERAL: 'General',
    }
    const departmentLabel = department ? departmentLabels[department] : null
    const ticketTitle = departmentLabel 
      ? `[TICKET][${departmentLabel}] ${title}`
      : `[TICKET] ${title}`

    // Create ticket room and memberships in a transaction to ensure consistency
    const ticketRoom = await prisma.$transaction(async (tx) => {
      // Create ticket room
      const room = await tx.room.create({
        data: {
          name: ticketName,
          title: ticketTitle,
          description: description,
          type: RoomType.TICKET,
          status: TicketStatus.OPEN,
          ticketDepartment: (department as TicketDepartment) || null,
          isPrivate: true,
          creatorId: dbUser.id,
        },
      })

      // Add assignee as OWNER (only one OWNER per ticket)
      await tx.roomMember.create({
        data: {
          userId: assigneeId,
          roomId: room.id,
          role: 'OWNER',
        },
      })

      // If creator is different from assignee, add creator as MODERATOR
      if (assigneeId !== dbUser.id) {
        await tx.roomMember.create({
          data: {
            userId: dbUser.id,
            roomId: room.id,
            role: 'MODERATOR',
          },
        })
      }

      return room
    })

    // Create the first message (the issue description)
    await prisma.message.create({
      data: {
        roomId: ticketRoom.id,
        userId: dbUser.id,
        content: description,
      },
    })

    return Response.json({
      ok: true,
      data: {
        ticketId: ticketRoom.id,
        ticketName: ticketRoom.name,
      },
    })
  } catch (error: any) {
    console.error('Error creating ticket:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

