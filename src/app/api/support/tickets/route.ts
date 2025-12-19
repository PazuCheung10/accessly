import { prisma } from '@/lib/prisma'
import { checkSupportFormRate } from '@/lib/rateLimit'
import { isInternalUser } from '@/lib/user-utils'
import { z } from 'zod'
import { Role, TicketDepartment } from '@prisma/client'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/apiError'
import { withRequestLogging } from '@/lib/requestLogger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TicketInput = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  department: z.enum(['IT_SUPPORT', 'BILLING', 'PRODUCT', 'GENERAL']).default('GENERAL'),
})

/**
 * POST /api/support/tickets
 * Create a new support ticket (external customers only)
 * Internal employees are blocked from submitting tickets
 */
async function POSTHandler(request: Request) {
  try {
    // Rate limiting: use IP address for anonymous users
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'
    
    try {
      await checkSupportFormRate(ip)
    } catch (error: any) {
      if (error.code === 'RATE_LIMITED') {
        return Response.json({
          ok: false,
          code: 'RATE_LIMITED',
          message: error.message || "You're submitting support requests too fast",
        }, { status: 429 })
      }
      throw error
    }

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
      // New users are external customers by default
      user = await prisma.user.create({
        data: {
          email: validated.data.email,
          name: validated.data.name,
          role: Role.USER,
        },
      })
    } else {
      // Check if existing user is an internal employee
      // Internal employees should not submit tickets via public form
      const userIsInternal = await isInternalUser(user.id)
      if (userIsInternal) {
        return Response.json({
          ok: false,
          code: 'FORBIDDEN',
          message: 'Internal employees cannot submit tickets via the public support form. Please use internal rooms for internal issues.',
        }, { status: 403 })
      }

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

    // Format department label for title
    const departmentLabels: Record<TicketDepartment, string> = {
      IT_SUPPORT: 'IT Support',
      BILLING: 'Billing',
      PRODUCT: 'Product',
      GENERAL: 'General',
    }
    const departmentLabel = departmentLabels[validated.data.department as TicketDepartment]

    // Create ticket room with department
    const ticketRoom = await prisma.room.create({
      data: {
        name: ticketName,
        title: `[TICKET][${departmentLabel}] ${validated.data.subject}`,
        description: `Support ticket from ${validated.data.name} (${validated.data.email})`,
        type: 'TICKET',
        status: 'OPEN',
        ticketDepartment: validated.data.department as TicketDepartment,
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
    return await handleApiError(
      error,
      {
        routeName: 'POST /api/support/tickets',
      },
      request
    )
  }
}

// Export with request logging
export const POST = withRequestLogging(POSTHandler, 'POST /api/support/tickets')

