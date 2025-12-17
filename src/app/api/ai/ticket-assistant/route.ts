import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, RoomType } from '@prisma/client'
import { isInternalUser } from '@/lib/user-utils'

export const dynamic = 'force-dynamic'

// Simple in-memory cache (for MVP)
// In production, consider using Redis or similar
interface CacheEntry {
  data: any
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000

function getCacheKey(roomId: string, lastMessageId: string | null, lastMessageAt: string | null): string {
  return `ticket-assistant:${roomId}:${lastMessageId || 'none'}:${lastMessageAt || 'none'}`
}

function getCached(key: string): any | null {
  const entry = cache.get(key)
  if (!entry) return null
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  
  return entry.data
}

function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

/**
 * POST /api/ai/ticket-assistant
 * Get AI insights for a ticket (internal staff only)
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
    const { roomId } = body

    if (!roomId) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'roomId is required',
      }, { status: 400 })
    }

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

    // Fetch last 15-20 messages
    const messages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        content: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    })

    // Get last message info for cache key
    const lastMessage = messages[0] || null
    const lastMessageId = lastMessage?.id || null
    const lastMessageAt = lastMessage?.createdAt.toISOString() || null

    // Check cache
    const cacheKey = getCacheKey(roomId, lastMessageId, lastMessageAt)
    const cached = getCached(cacheKey)
    if (cached) {
      return Response.json({
        ok: true,
        data: cached,
        cached: true,
      })
    }

    // Reverse messages to chronological order for processing
    const chronologicalMessages = [...messages].reverse()

    // Anonymize messages: replace names/emails with role labels
    const anonymizedMessages = chronologicalMessages.map((msg) => {
      // Determine role label
      let roleLabel = 'Customer'
      if (msg.user?.role === Role.ADMIN) {
        roleLabel = 'Support Agent'
      } else {
        // Check if user is a member with OWNER/MODERATOR role (admin)
        // We'll use a simple heuristic: if user is admin, they're support
        // Otherwise, they're a customer
        // Note: This is simplified for MVP; in production, check membership role
      }

      return {
        role: roleLabel,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
      }
    })

    // Build mock response (MVP - no real AI call yet)
    const mockInsights = generateMockInsights(room, anonymizedMessages)

    // Cache the response
    setCache(cacheKey, mockInsights)

    return Response.json({
      ok: true,
      data: mockInsights,
      cached: false,
    })
  } catch (error: any) {
    console.error('Error in ticket-assistant API:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

/**
 * Generate mock AI insights based on ticket data
 * This is a placeholder for real AI integration
 */
function generateMockInsights(
  room: {
    title: string
    description: string | null
    status: string | null
    ticketDepartment: string | null
  },
  messages: Array<{ role: string; content: string; timestamp: string }>
): {
  summary: string
  suggestions: string[]
  escalation: {
    recommended: boolean
    department?: string
    reason?: string
  }
} {
  // Simple heuristics for mock responses
  const hasRecentActivity = messages.length > 0
  const lastMessage = messages[messages.length - 1]
  const isCustomerMessage = lastMessage?.role === 'Customer'
  const messageCount = messages.length

  // Generate summary
  let summary = `This is a ${room.ticketDepartment || 'General'} support ticket`
  if (room.status) {
    summary += ` with status "${room.status}"`
  }
  summary += `. `
  
  if (messageCount === 0) {
    summary += 'No messages have been exchanged yet.'
  } else if (messageCount === 1) {
    summary += 'The customer has submitted an initial request.'
  } else {
    summary += `There have been ${messageCount} messages exchanged.`
    if (isCustomerMessage) {
      summary += ' The customer is waiting for a response.'
    } else {
      summary += ' A support agent has responded.'
    }
  }

  // Generate suggestions (mock)
  const suggestions = [
    `Thank you for contacting us about "${room.title}". I understand your concern and I'm here to help. Let me investigate this issue for you.`,
    `I've reviewed your ticket and I can help you resolve this. Based on the information provided, I recommend the following steps...`,
    `I appreciate your patience. I'm currently looking into this matter and will provide you with an update shortly.`,
  ]

  // Determine escalation (mock logic)
  const needsEscalation = room.status === 'OPEN' && messageCount > 3 && isCustomerMessage
  const escalation = needsEscalation
    ? {
        recommended: true,
        department: room.ticketDepartment || 'GENERAL',
        reason: 'Multiple customer messages without response. Consider escalating to specialized team.',
      }
    : {
        recommended: false,
      }

  return {
    summary,
    suggestions,
    escalation,
  }
}

