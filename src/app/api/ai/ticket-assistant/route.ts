import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, RoomType } from '@prisma/client'
import { isInternalUser } from '@/lib/user-utils'
import { TicketAIService } from '@/lib/ai/service'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/apiError'
import { withRequestLogging } from '@/lib/requestLogger'
import { metricsStore } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/ticket-assistant
 * Get AI insights for a ticket (internal staff only)
 */
async function POSTHandler(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      }, { status: 401 })
    }

    // Verify user exists in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, role: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'User not found',
      }, { status: 401 })
    }

    // Verify user is internal (staff/admin)
    const userIsInternal = await isInternalUser(dbUser.id)
    if (!userIsInternal) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'AI Assistant is only available for internal staff',
      }, { status: 403 })
    }

    const body = await request.json()
    const { roomId, action } = body

    if (!roomId) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'roomId is required',
      }, { status: 400 })
    }

    if (action && action !== 'peek' && action !== 'refresh') {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'action must be "peek" or "refresh"',
      }, { status: 400 })
    }

    // Default to 'peek' if action not specified (backward compatibility)
    const requestAction = action || 'peek'

    // Verify room exists and is a TICKET
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        status: true,
        ticketDepartment: true,
        createdAt: true,
      },
    })

    if (!room) {
      return Response.json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Room not found',
      }, { status: 404 })
    }

    if (room.type !== RoomType.TICKET) {
      return Response.json({
        ok: false,
        code: 'INVALID_ROOM_TYPE',
        message: 'AI Assistant is only available for TICKET rooms',
      }, { status: 400 })
    }

    // Check access: user must be a member OR be an admin
    const membership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: dbUser.id,
          roomId,
        },
      },
    })

    const isAdmin = dbUser.role === Role.ADMIN
    const hasAccess = !!membership || isAdmin

    if (!hasAccess) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'You do not have access to this ticket',
      }, { status: 403 })
    }

    const service = new TicketAIService()

    if (requestAction === 'peek') {
      // PEEK: Return existing insights without updating
      const result = await service.peekInsights(roomId)
      
      if (!result) {
        // No existing summary
        return Response.json({
          ok: true,
          data: null,
          provider: null,
          meta: {
            hasNewMessages: false,
            newMessageCount: 0,
            summarizedMessageCount: 0,
          },
        })
      }

      return Response.json({
        ok: true,
        data: result.insights,
        provider: result.provider,
        meta: {
          hasNewMessages: result.hasNewMessages,
          newMessageCount: result.newMessageCount,
          summarizedMessageCount: result.summarizedMessageCount,
        },
      })
    } else {
      // REFRESH: Generate/update insights
      const { forceFullRefresh } = body
      const result = await service.generateInsights(roomId, forceFullRefresh === true)

      return Response.json({
        ok: true,
        data: result.insights,
        provider: result.provider,
        meta: {
          hasNewMessages: result.hasNewMessages,
          newMessageCount: result.newMessageCount,
          summarizedMessageCount: result.summarizedMessageCount,
        },
      })
    }
  } catch (error: any) {
    // Track AI failure in metrics
    metricsStore.incrementAIFailure()

    const session = await auth().catch(() => null)
    const dbUser = session?.user?.email
      ? await prisma.user.findUnique({ where: { email: session.user.email || '' }, select: { id: true } }).catch(() => null)
      : null
    
    return await handleApiError(
      error,
      {
        routeName: 'POST /api/ai/ticket-assistant',
        userId: dbUser?.id,
      },
      request
    )
  }
}

// Export with request logging
export const POST = withRequestLogging(POSTHandler, 'POST /api/ai/ticket-assistant')
