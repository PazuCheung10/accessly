import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoomType } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/rooms/discover
 * List public rooms with search, tag filter, sort, and pagination
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

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || '' // Search query
    const tag = searchParams.get('tag') || '' // Tag filter
    const sort = searchParams.get('sort') || 'active' // active, new, members
    const cursor = searchParams.get('cursor') || null // Pagination cursor
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    // Build where clause
    const where: any = {
      type: RoomType.PUBLIC, // Only public rooms
    }

    // Search filter (title, name, description)
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    }

    // Tag filter
    if (tag) {
      where.tags = { has: tag }
    }

    // Cursor pagination
    if (cursor) {
      where.id = { lt: cursor }
    }

    // Build orderBy clause
    let orderBy: any = {}
    switch (sort) {
      case 'new':
        orderBy = { createdAt: 'desc' }
        break
      case 'members':
        orderBy = { members: { _count: 'desc' } }
        break
      case 'active':
      default:
        // Sort by most recent message
        orderBy = { messages: { _max: { createdAt: 'desc' } } }
        break
    }

    // Fetch rooms
    const rooms = await prisma.room.findMany({
      where,
      take: limit + 1, // Fetch one extra to check if there are more
      orderBy,
      select: {
        id: true,
        name: true,
        title: true,
        description: true,
        tags: true,
        type: true,
        isPrivate: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    })

    // Check if there are more results
    const hasMore = rooms.length > limit
    const roomsToReturn = hasMore ? rooms.slice(0, limit) : rooms
    const nextCursor = hasMore && roomsToReturn.length > 0
      ? roomsToReturn[roomsToReturn.length - 1].id
      : null

    return Response.json({
      ok: true,
      code: 'SUCCESS',
      message: 'Rooms retrieved successfully',
      data: {
        rooms: roomsToReturn,
        cursor: nextCursor,
        hasMore,
        count: roomsToReturn.length,
      },
    })
  } catch (error: any) {
    console.error('Error discovering rooms:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

