/**
 * GET /api/health
 * Health check endpoint for monitoring
 * Checks DB and Redis connectivity
 */
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import Redis from 'ioredis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface HealthStatus {
  ok: boolean
  db: 'up' | 'down' | 'not_used'
  redis: 'up' | 'down' | 'not_used'
  timestamp: string
}

export async function GET(): Promise<Response> {
  const status: HealthStatus = {
    ok: true,
    db: 'down',
    redis: env.REDIS_URL ? 'down' : 'not_used',
    timestamp: new Date().toISOString(),
  }

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`
    status.db = 'up'
  } catch (error) {
    status.db = 'down'
    status.ok = false
  }

  // Check Redis connectivity (if configured)
  if (env.REDIS_URL) {
    try {
      const redis = new Redis(env.REDIS_URL)
      await redis.ping()
      await redis.quit()
      status.redis = 'up'
    } catch (error) {
      status.redis = 'down'
      status.ok = false
    }
  }

  return Response.json(status, {
    status: status.ok ? 200 : 503,
  })
}

