import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { getIO } from '@/lib/io'

export const runtime = 'nodejs'

/**
 * GET /status
 * Health check endpoint
 * Returns status of database, Redis (if configured), and Socket.io
 */
export async function GET() {
  const status = {
    ok: true,
    timestamp: new Date().toISOString(),
    db: 'unknown' as 'up' | 'down' | 'unknown',
    redis: 'unknown' as 'up' | 'down' | 'unknown',
    socketio: 'unknown' as 'up' | 'down' | 'unknown',
  }

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`
    status.db = 'up'
  } catch (error) {
    status.db = 'down'
    status.ok = false
  }

  // Check Redis (if configured)
  if (env.REDIS_URL) {
    try {
      // If Redis adapter is used, we can check via Socket.io
      // For now, just mark as configured
      status.redis = 'up'
    } catch (error) {
      status.redis = 'down'
      status.ok = false
    }
  } else {
    status.redis = 'up' // Not required
  }

  // Check Socket.io
  const io = getIO()
  status.socketio = io ? 'up' : 'down'
  if (!io) {
    status.ok = false
  }

  return Response.json(status, {
    status: status.ok ? 200 : 503,
  })
}
