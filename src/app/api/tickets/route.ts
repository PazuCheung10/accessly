import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
          where: {
            parentMessageId: null, // Only root messages (the ticket content)
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1, // Get the first message (ticket content)
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
          id: ticket.id,
          name: ticket.name,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          department: ticket.ticketDepartment,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          creator: ticket.creator,
          owner: ticket.members.find((m) => m.role === 'OWNER')?.user,
          firstMessage: ticket.messages[0] ? {
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

