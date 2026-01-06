import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/users/list?search=...
 * List users with search capability (for room owners/moderators to invite users)
 * Returns limited user info (no sensitive data like ban info)
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || null

    const where: any = {}
    
    // Add search filter for name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        // Don't include sensitive info like role, department, ban info
      },
      orderBy: {
        name: 'asc', // Sort by name for easier browsing
      },
      take: 100, // Limit results to prevent abuse
    })

    return Response.json({
      ok: true,
      data: {
        users,
      },
    })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}







