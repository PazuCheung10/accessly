import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, RoomType } from '@prisma/client'
import { isInternalUser } from '@/lib/user-utils'
import { TicketAIService } from '@/lib/ai/service'

export const dynamic = 'force-dynamic'

// Simple in-memory cache (for MVP)
// In production, consider using Redis or similar
interface CacheEntry {
  data: any
  provider: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000

function getCacheKey(roomId: string, lastMessageId: string | null, lastMessageAt: string | null): string {
  return `ticket-assistant:${roomId}:${lastMessageId || 'none'}:${lastMessageAt || 'none'}`
}

function getCached(key: string): { data: any; provider: string } | null {
  const entry = cache.get(key)
  if (!entry) return null
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  
  return { data: entry.data, provider: entry.provider }
}

function setCache(key: string, data: any, provider: string): void {
  cache.set(key, {
    data,
    provider,
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

    // Get last message info for cache key
    const lastMessage = await prisma.message.findFirst({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    })

    const lastMessageId = lastMessage?.id || null
    const lastMessageAt = lastMessage?.createdAt.toISOString() || null

    // Check cache
    const cacheKey = getCacheKey(roomId, lastMessageId, lastMessageAt)
    const cached = getCached(cacheKey)
    if (cached) {
      return Response.json({
        ok: true,
        data: cached.data,
        provider: cached.provider,
        cached: true,
      })
    }

    // Generate insights using service
    const service = new TicketAIService()
    const { insights, provider } = await service.generateInsights(roomId)

    // Cache the response
    setCache(cacheKey, insights, provider)

    return Response.json({
      ok: true,
      data: insights,
      provider,
      cached: false,
    })
  } catch (error: any) {
    console.error('Error in ticket-assistant API:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
    }, { status: 500 })
  }
}
