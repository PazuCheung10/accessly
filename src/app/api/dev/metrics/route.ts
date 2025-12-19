/**
 * GET /api/dev/metrics
 * Developer-only endpoint for viewing operational metrics
 * 
 * Protection:
 * - Only accessible in development mode (NODE_ENV === 'development')
 * - OR if admin authentication is provided (for production debugging)
 * 
 * Returns simple counters for:
 * - Total 5xx errors
 * - 5xx errors by route
 * - AI assistant failures
 * - Socket connections/disconnections
 */

import { metricsStore } from '@/lib/metrics'
import { auth } from '@/lib/auth'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  // Protection: Only allow in development OR if admin user
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment) {
    // In production, require admin authentication
    try {
      const session = await auth()
      if (!session?.user?.email) {
        return Response.json(
          {
            ok: false,
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
          },
          { status: 401 }
        )
      }

      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
      })

      if (!dbUser || dbUser.role !== Role.ADMIN) {
        return Response.json(
          {
            ok: false,
            code: 'FORBIDDEN',
            message: 'Admin access required',
          },
          { status: 403 }
        )
      }
    } catch (error) {
      return Response.json(
        {
          ok: false,
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        },
        { status: 401 }
      )
    }
  }

  // Return metrics snapshot
  const metrics = metricsStore.getOperationalMetrics()

  return Response.json({
    ok: true,
    data: {
      ...metrics,
      timestamp: new Date().toISOString(),
      note: 'Metrics are approximate and reset on server restart. For multi-instance deployments, these are per-instance only.',
    },
  })
}

