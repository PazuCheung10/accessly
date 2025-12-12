import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoomType } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/tickets/my-tickets
 * List tickets for the logged-in user (external customers)
 * Returns only tickets where the user is a member
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

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'User not found',
      }, { status: 404 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'OPEN' | 'WAITING' | 'RESOLVED' | null

    // Fetch tickets where user is a member
    const memberships = await prisma.roomMember.findMany({
      where: {
        userId: dbUser.id,
        room: {
          type: RoomType.TICKET,
          ...(status ? { status } : {}),
        },
      },
      include: {
        room: {
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
              take: 1, // Get the last message for preview
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
        },
      },
      orderBy: {
        room: {
          updatedAt: 'desc',
        },
      },
    })

    const tickets = memberships.map((membership) => {
      const ticket = membership.room
      return {
        id: ticket.id,
        roomId: ticket.id,
        name: ticket.name,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        department: ticket.ticketDepartment,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        creator: ticket.creator,
        assignedAdmin: ticket.members.find((m) => m.role === 'OWNER')?.user || null,
        lastMessage: ticket.messages[0] ? {
          id: ticket.messages[0].id,
          content: ticket.messages[0].content,
          createdAt: ticket.messages[0].createdAt.toISOString(),
          user: ticket.messages[0].user,
        } : null,
        messageCount: ticket._count.messages,
      }
    })

    return Response.json({
      ok: true,
      data: {
        tickets,
      },
    })
  } catch (error: any) {
    console.error('Error fetching my tickets:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}


