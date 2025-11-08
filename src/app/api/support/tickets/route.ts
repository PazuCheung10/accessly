import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TicketInput = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
})

/**
 * POST /api/support/tickets
 * Create a new support ticket (public, no auth required)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const validated = TicketInput.safeParse(body)
    if (!validated.success) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid ticket input',
        details: validated.error.errors,
      }, { status: 400 })
    }

    // Find or create user by email (for anonymous support tickets)
    let user = await prisma.user.findUnique({
      where: { email: validated.data.email },
    })

    if (!user) {
      // Create a new user for this ticket (they can sign up later)
      user = await prisma.user.create({
        data: {
          email: validated.data.email,
          name: validated.data.name,
          role: Role.USER,
        },
      })
    } else {
      // Update name if provided and different
      if (validated.data.name && user.name !== validated.data.name) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: validated.data.name },
        })
      }
    }

    // Find an admin to assign as OWNER
    const admin = await prisma.user.findFirst({
      where: { role: Role.ADMIN },
      orderBy: { createdAt: 'asc' }, // Assign to first admin (oldest)
    })

    if (!admin) {
      return Response.json({
        ok: false,
        code: 'NO_ADMIN',
        message: 'No admin available to assign ticket',
      }, { status: 500 })
    }

    // Generate unique room name for ticket
    const ticketName = `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Create ticket room
    const ticketRoom = await prisma.room.create({
      data: {
        name: ticketName,
        title: validated.data.subject,
        description: `Support ticket from ${validated.data.name} (${validated.data.email})`,
        type: 'TICKET',
        status: 'OPEN',
        isPrivate: true,
        creatorId: user.id,
      },
    })

    // Add user as MEMBER
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: ticketRoom.id,
        role: 'MEMBER',
      },
    })

    // Add admin as OWNER
    await prisma.roomMember.create({
      data: {
        userId: admin.id,
        roomId: ticketRoom.id,
        role: 'OWNER',
      },
    })

    // Create the first message (the ticket content)
    const message = await prisma.message.create({
      data: {
        roomId: ticketRoom.id,
        userId: user.id,
        content: validated.data.message,
      },
      select: {
        id: true,
        roomId: true,
        userId: true,
        content: true,
        parentMessageId: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        reactions: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return Response.json({
      ok: true,
      data: {
        ticketId: ticketRoom.id,
        ticketName: ticketRoom.name,
        message: {
          ...message,
          createdAt: message.createdAt.toISOString(),
          editedAt: message.editedAt?.toISOString() || null,
          deletedAt: message.deletedAt?.toISOString() || null,
        },
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

