import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseSearchQuery, buildTsQuery, extractSnippet } from '@/lib/search'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/search
 * Full-text search across messages and rooms
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

    const body = await request.json()
    const { query, roomId } = body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Query is required',
      }, { status: 400 })
    }

    // Verify user exists in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Parse query for complex syntax
    const parsed = parseSearchQuery(query)
    const tsQuery = buildTsQuery(parsed.text)

    if (!tsQuery && !parsed.from && !parsed.tag && !parsed.before && !parsed.after) {
      return Response.json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid search query',
      }, { status: 400 })
    }

    // Build search conditions
    const messageWhere: any[] = []
    const roomWhere: any[] = []

    // Full-text search on messages
    if (tsQuery) {
      messageWhere.push({
        searchVector: {
          search: tsQuery,
        },
      })
    }

    // Room filter
    if (roomId) {
      messageWhere.push({ roomId })
    }

    // User filter (from:)
    if (parsed.from) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { contains: parsed.from, mode: 'insensitive' } },
            { name: { contains: parsed.from, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      })
      if (user) {
        messageWhere.push({ userId: user.id })
      } else {
        // No user found, return empty results
        return Response.json({
          ok: true,
          data: {
            messages: [],
            rooms: [],
          },
        })
      }
    }

    // Date filters
    if (parsed.before) {
      messageWhere.push({ createdAt: { lt: parsed.before } })
    }
    if (parsed.after) {
      messageWhere.push({ createdAt: { gt: parsed.after } })
    }

    // Exclude deleted messages
    messageWhere.push({ deletedAt: null })

    // Build message search query with proper parameterization
    const messageQueryParts: string[] = []
    const messageParams: any[] = []
    let paramIndex = 1

    // Base query
    let messageSql = `
      SELECT 
        m.id,
        m."roomId",
        m."userId",
        m.content,
        m."parentMessageId",
        m."createdAt",
        ts_rank(m."searchVector", to_tsquery('english', $${paramIndex})) as score,
        r.title as "roomTitle",
        u.name as "userName",
        u.email as "userEmail"
      FROM "Message" m
      INNER JOIN "Room" r ON m."roomId" = r.id
      INNER JOIN "User" u ON m."userId" = u.id
      WHERE 
    `
    messageParams.push(tsQuery || ':*')
    paramIndex++

    // Add conditions
    if (tsQuery) {
      messageQueryParts.push(`m."searchVector" @@ to_tsquery('english', $${paramIndex})`)
      messageParams.push(tsQuery)
      paramIndex++
    } else {
      messageQueryParts.push('TRUE')
    }

    if (roomId) {
      messageQueryParts.push(`m."roomId" = $${paramIndex}`)
      messageParams.push(roomId)
      paramIndex++
    }

    if (parsed.from) {
      messageQueryParts.push(`(u.email ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex + 1})`)
      messageParams.push(`%${parsed.from}%`)
      messageParams.push(`%${parsed.from}%`)
      paramIndex += 2
    }

    if (parsed.before) {
      messageQueryParts.push(`m."createdAt" < $${paramIndex}`)
      messageParams.push(parsed.before)
      paramIndex++
    }

    if (parsed.after) {
      messageQueryParts.push(`m."createdAt" > $${paramIndex}`)
      messageParams.push(parsed.after)
      paramIndex++
    }

    messageQueryParts.push('m."deletedAt" IS NULL')
    messageQueryParts.push(`EXISTS (
      SELECT 1 FROM "RoomMember" rm 
      WHERE rm."roomId" = m."roomId" 
      AND rm."userId" = $${paramIndex}
    )`)
    messageParams.push(dbUser.id)
    paramIndex++

    messageSql += messageQueryParts.join(' AND ')
    messageSql += ` ORDER BY score DESC, m."createdAt" DESC LIMIT 50`

    // Search messages using raw SQL for tsvector
    const messageResults = await prisma.$queryRawUnsafe<Array<{
      id: string
      roomId: string
      userId: string
      content: string
      parentMessageId: string | null
      createdAt: Date
      score: number
      roomTitle: string
      userName: string
      userEmail: string
    }>>(messageSql, ...messageParams)

    // Get parent messages for context
    const parentMessageIds = messageResults
      .filter(m => m.parentMessageId)
      .map(m => m.parentMessageId)
      .filter((id): id is string => id !== null)

    const parentMessages = parentMessageIds.length > 0
      ? await prisma.message.findMany({
          where: { id: { in: parentMessageIds } },
          select: {
            id: true,
            content: true,
            userId: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      : []

    const parentMap = new Map(parentMessages.map(p => [p.id, p]))

    // Format message results with snippets and context
    const formattedMessages = messageResults.map((msg) => {
      const snippet = extractSnippet(msg.content, parsed.text)
      const parent = msg.parentMessageId ? parentMap.get(msg.parentMessageId) : null

      return {
        id: msg.id,
        roomId: msg.roomId,
        roomTitle: msg.roomTitle,
        content: msg.content,
        snippet,
        parentMessageId: msg.parentMessageId,
        parentContext: parent ? {
          id: parent.id,
          content: parent.content,
          user: parent.user,
        } : null,
        createdAt: msg.createdAt.toISOString(),
        score: Number(msg.score),
        user: {
          id: msg.userId,
          name: msg.userName,
          email: msg.userEmail,
        },
      }
    })

    // Search rooms if no roomId filter
    let formattedRooms: any[] = []
    if (!roomId) {
      const roomQueryParts: string[] = []
      const roomParams: any[] = []
      let roomParamIndex = 1

      let roomSql = `
        SELECT 
          r.id,
          r.title,
          r.description,
          r.type,
          ts_rank(r."searchVector", to_tsquery('english', $${roomParamIndex})) as score
        FROM "Room" r
        WHERE 
      `
      roomParams.push(tsQuery || ':*')
      roomParamIndex++

      if (tsQuery) {
        roomQueryParts.push(`r."searchVector" @@ to_tsquery('english', $${roomParamIndex})`)
        roomParams.push(tsQuery)
        roomParamIndex++
      } else {
        roomQueryParts.push('TRUE')
      }

      if (parsed.tag) {
        roomQueryParts.push(`$${roomParamIndex} = ANY(r.tags)`)
        roomParams.push(parsed.tag)
        roomParamIndex++
      }

      roomQueryParts.push(`EXISTS (
        SELECT 1 FROM "RoomMember" rm 
        WHERE rm."roomId" = r.id 
        AND rm."userId" = $${roomParamIndex}
      )`)
      roomParams.push(dbUser.id)
      roomParamIndex++

      roomSql += roomQueryParts.join(' AND ')
      roomSql += ` ORDER BY score DESC LIMIT 20`

      const roomResults = await prisma.$queryRawUnsafe<Array<{
        id: string
        title: string
        description: string | null
        type: string
        score: number
      }>>(roomSql, ...roomParams)

      formattedRooms = roomResults.map((room) => ({
        id: room.id,
        title: room.title,
        description: room.description,
        type: room.type,
        score: Number(room.score),
      }))
    }

    return Response.json({
      ok: true,
      data: {
        messages: formattedMessages,
        rooms: formattedRooms,
        query: parsed,
      },
    })
  } catch (error: any) {
    console.error('Error searching:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

