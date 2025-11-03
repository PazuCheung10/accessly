import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertRole } from '@/lib/rbac'
import { Role } from '@prisma/client'

export const runtime = 'nodejs'

/**
 * GET /api/users
 * List all users (admin-only)
 * Requires ADMIN role via assertRole
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      })
    }

    // Assert ADMIN role
    try {
      assertRole(session, Role.ADMIN)
    } catch (error: any) {
      if (error.code === 'INSUFFICIENT_ROLE') {
        return Response.json({
          ok: false,
          code: 'INSUFFICIENT_ROLE',
          message: 'Admin access required',
        })
      }
      throw error
    }

    // Fetch all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return Response.json({
      ok: true,
      data: {
        users,
        count: users.length,
      },
    })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    })
  }
}