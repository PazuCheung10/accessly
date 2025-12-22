import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role, RoomType } from '@prisma/client'
import { normalizeAuditLog, normalizeRoom, normalizeMessage } from '@/lib/activity/normalize'
import { ActivityEvent } from '@/lib/activity/types'
import { isExternalCustomer } from '@/lib/user-utils'
import { getAccessibleRoomIds } from '@/lib/room-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/activity/feed
 * Get activity feed with events from tickets, rooms, and messages
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
      select: { id: true, role: true, department: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const cursor = searchParams.get('cursor')
    const typesParam = searchParams.get('types') // Comma-separated event types

    // Parse event type filter
    const allowedTypes = typesParam
      ? typesParam.split(',').filter(Boolean)
      : null

    const userId = dbUser.id
    const isAdmin = dbUser.role === Role.ADMIN
    const userIsExternal = await isExternalCustomer(userId)

    // Get accessible room IDs for filtering
    let accessibleRoomIds: string[] = []
    let ticketRoomIds: string[] = []

    if (userIsExternal) {
      // External customers: only see their own tickets
      const ticketMemberships = await prisma.roomMember.findMany({
        where: { userId },
        include: {
          room: {
            select: { id: true, type: true },
          },
        },
      })
      ticketRoomIds = ticketMemberships
        .filter((m) => m.room.type === RoomType.TICKET)
        .map((m) => m.room.id)
    } else {
      // Internal users: get accessible rooms
      accessibleRoomIds = await getAccessibleRoomIds(
        userId,
        dbUser.role,
        dbUser.department
      )

      // For tickets: admins see all, non-admins see only their memberships
      if (isAdmin) {
        // Admins can see all tickets (no filter needed)
        ticketRoomIds = []
      } else {
        const ticketMemberships = await prisma.roomMember.findMany({
          where: {
            userId,
            room: { type: RoomType.TICKET },
          },
          select: { roomId: true },
        })
        ticketRoomIds = ticketMemberships.map((m) => m.roomId)
      }
    }

    // Parse cursor if provided (format: "source-id" like "audit-123" or "room-456")
    let cursorTimestamp: Date | null = null
    if (cursor) {
      // For initial load, we'll fetch more events and filter after merging
      // The cursor will be used after normalization to filter events
      try {
        // Try to extract timestamp from previous event if we stored it
        // For now, we'll fetch more events and filter after merge
        cursorTimestamp = null
      } catch {
        cursorTimestamp = null
      }
    }

    // Fetch events from all sources in parallel
    // We fetch more than needed to account for filtering, then apply cursor after merge
    const fetchLimit = cursor ? limit * 3 : limit * 2

    const [auditLogs, ticketRooms, regularRooms, messages] = await Promise.all([
      // Audit logs (status changes, assignments)
      prisma.auditLog.findMany({
        where: {
          action: { in: ['ticket.status.change', 'ticket.assign'] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        take: fetchLimit,
      }),

      // Ticket rooms (ticket created)
      prisma.room.findMany({
        where: {
          type: RoomType.TICKET,
          ...(userIsExternal
            ? { id: { in: ticketRoomIds } }
            : isAdmin
              ? {}
              : { id: { in: ticketRoomIds } }),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        take: fetchLimit,
      }),

      // Regular rooms (room created) - only for internal users
      userIsExternal
        ? Promise.resolve([])
        : prisma.room.findMany({
            where: {
              type: { in: [RoomType.PUBLIC, RoomType.PRIVATE] },
              creatorId: { not: null },
              id: { in: accessibleRoomIds },
            },
            orderBy: { createdAt: 'desc' },
            include: {
              creator: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
            take: fetchLimit,
          }),

      // Messages (message posted) - filter by accessible rooms
      prisma.message.findMany({
        where: {
          deletedAt: null,
          roomId: {
            in: userIsExternal
              ? ticketRoomIds
              : [...accessibleRoomIds, ...(isAdmin ? [] : ticketRoomIds)],
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
          room: {
            select: { id: true, title: true, type: true },
          },
        },
        take: fetchLimit,
      }),
    ])

    // Normalize and merge events
    const events: ActivityEvent[] = []

    // Normalize audit logs
    for (const log of auditLogs) {
      // Filter by room access for ticket events
      if (log.targetId) {
        if (log.action === 'ticket.status.change' || log.action === 'ticket.assign') {
          if (userIsExternal && !ticketRoomIds.includes(log.targetId)) {
            continue
          }
          if (!isAdmin && !userIsExternal && !ticketRoomIds.includes(log.targetId)) {
            continue
          }
        }
      }

      const normalized = normalizeAuditLog(log)
      if (normalized && (!allowedTypes || allowedTypes.includes(normalized.type))) {
        events.push(normalized)
      }
    }

    // Normalize ticket rooms
    for (const room of ticketRooms) {
      const normalized = normalizeRoom(room, 'ticket.created')
      if (!allowedTypes || allowedTypes.includes(normalized.type)) {
        events.push(normalized)
      }
    }

    // Normalize regular rooms
    for (const room of regularRooms) {
      const normalized = normalizeRoom(room, 'room.created')
      if (!allowedTypes || allowedTypes.includes(normalized.type)) {
        events.push(normalized)
      }
    }

    // Normalize messages
    for (const message of messages) {
      const normalized = normalizeMessage(message)
      if (!allowedTypes || allowedTypes.includes(normalized.type)) {
        events.push(normalized)
      }
    }

    // Sort by timestamp descending, then by ID for consistent ordering
    events.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      if (timeDiff !== 0) return timeDiff
      return b.id.localeCompare(a.id)
    })

    // Apply cursor pagination
    let filteredEvents = events
    if (cursor) {
      const cursorIndex = events.findIndex((e) => e.id === cursor)
      if (cursorIndex >= 0) {
        // Start from the event after the cursor
        filteredEvents = events.slice(cursorIndex + 1)
      } else {
        // Cursor not found, might be from a different query - return empty
        filteredEvents = []
      }
    }

    // Take top N
    const eventsToReturn = filteredEvents.slice(0, limit)
    const hasMore = filteredEvents.length > limit
    const nextCursor = hasMore && eventsToReturn.length > 0
      ? eventsToReturn[eventsToReturn.length - 1].id
      : null

    return Response.json({
      ok: true,
      data: {
        events: eventsToReturn,
        cursor: nextCursor,
        hasMore,
      },
    })
  } catch (error: any) {
    console.error('Error fetching activity feed:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

