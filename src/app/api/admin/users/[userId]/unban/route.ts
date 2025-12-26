import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertRole } from '@/lib/rbac'
import { Role } from '@prisma/client'
import { logAction } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/users/[userId]/unban
 * Unban a user (admin only)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })
    }

    assertRole(session, Role.ADMIN)

    const { userId } = await params

    // Get admin user from DB
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true },
    })

    if (!adminUser) {
      return Response.json({ ok: false, code: 'USER_NOT_FOUND' }, { status: 404 })
    }

    // Check if ban exists
    const ban = await prisma.userBan.findUnique({
      where: { userId },
    })

    if (!ban) {
      return Response.json({ ok: false, code: 'NOT_FOUND', message: 'User is not banned' }, { status: 404 })
    }

    // Remove ban
    await prisma.userBan.delete({
      where: { userId },
    })

    // Log action
    await logAction('user.unban', adminUser.id, 'user', userId)

    return Response.json({ ok: true, data: { userId } })
  } catch (error: any) {
    if (error.code === 'INSUFFICIENT_ROLE') {
      return Response.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 })
    }
    console.error('Error unbanning user:', error)
    return Response.json({ ok: false, code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

