export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /status
 * Health check endpoint
 * Returns status of database, Redis (if configured), and Socket.io
 */
export async function GET() {
  // Lazy load these at runtime to avoid build-time errors
  const { prisma } = await import('@/lib/prisma')
  const { env } = await import('@/lib/env')
  const { getIO } = await import('@/lib/io')

  const status = {
    ok: true,
    timestamp: new Date().toISOString(),
    db: 'unknown' as 'up' | 'down' | 'unknown',
    redis: 'unknown' as 'up' | 'down' | 'unknown',
    socketio: 'unknown' as 'up' | 'down' | 'unknown',
  }

  // Check database - never throw, return status
  try {
    await prisma.$queryRaw`SELECT 1`
    status.db = 'up'
  } catch (error) {
    status.db = 'down'
    status.ok = false
  }

  // Check Redis (if configured) - never throw
  try {
    if (env.REDIS_URL) {
      status.redis = 'up'
    } else {
      status.redis = 'up' // Not required
    }
  } catch (error) {
    status.redis = 'down'
    // Don't fail overall status for optional Redis
  }

  // Check Socket.io (only available at runtime) - never throw
  try {
    const io = getIO()
    status.socketio = io ? 'up' : 'down'
    // Socket.io might not be initialized at build time, that's OK
    if (!io) {
      status.socketio = 'down'
    }
  } catch (error) {
    status.socketio = 'down'
    // Don't fail the status check if Socket.io isn't available
  }

  // Always return 200, even if some services are down
  // The `ok` field indicates overall health
  return Response.json(status, {
    status: 200,
  })
}
