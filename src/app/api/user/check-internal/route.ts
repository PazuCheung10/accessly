import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isInternalUser } from '@/lib/user-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/user/check-internal
 * Check if the logged-in user is an internal employee and return user info including department
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: true,
        isInternal: false,
        message: 'Not logged in',
      })
    }

    // Get user from database with department
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, role: true, department: true },
    })

    if (!dbUser) {
      return Response.json({
        ok: true,
        isInternal: false,
        message: 'User not found',
      })
    }

    // Check if user is internal
    const userIsInternal = await isInternalUser(dbUser.id)

    return Response.json({
      ok: true,
      isInternal: userIsInternal,
      role: dbUser.role,
      department: dbUser.department,
    })
  } catch (error: any) {
    console.error('Error checking user type:', error)
    return Response.json({
      ok: false,
      isInternal: false,
      message: 'Internal server error',
    }, { status: 500 })
  }
}

