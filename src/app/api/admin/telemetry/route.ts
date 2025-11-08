import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { metricsStore } from '@/lib/metrics'
import { getActiveSocketConnections } from '@/lib/telemetry'
import { Role } from '@prisma/client'
import os from 'os'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/telemetry
 * Get observability metrics (admin only)
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      }, { status: 401 })
    }

    // Verify user is admin
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, role: true },
    })

    if (!dbUser || dbUser.role !== Role.ADMIN) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Admin access required',
      }, { status: 403 })
    }

    // Get system metrics
    const memUsage = process.memoryUsage()
    // CPU usage calculation (simplified - in production, track over time)
    const cpuUsage = process.cpuUsage()
    // For a simple approximation, use load average if available
    const loadAvg = os.loadavg()[0] || 0
    const cpuCount = os.cpus().length
    const cpuPercent = Math.min(100, (loadAvg / cpuCount) * 100)

    // Get socket metrics
    const activeConnections = getActiveSocketConnections()
    const latencyStats = metricsStore.getSocketLatencyStats()

    // Get slow queries
    const slowQueries = metricsStore.getSlowQueries(5)

    // Get top active rooms
    const topActiveRooms = metricsStore.getTopActiveRooms(5)

    // Get messages per room per minute (aggregate)
    const allRoomsActivity = metricsStore.getRoomActivity()
    const messagesPerMinuteByRoom: Array<{ roomId: string; roomTitle: string; messagesPerMinute: number }> = []
    
    const roomMap = new Map<string, { roomTitle: string; messages: number }>()
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    
    for (const activity of allRoomsActivity) {
      if (activity.timestamp > oneMinuteAgo) {
        const existing = roomMap.get(activity.roomId) || { roomTitle: activity.roomTitle, messages: 0 }
        existing.messages += activity.messageCount
        roomMap.set(activity.roomId, existing)
      }
    }

    for (const [roomId, data] of roomMap.entries()) {
      messagesPerMinuteByRoom.push({
        roomId,
        roomTitle: data.roomTitle,
        messagesPerMinute: data.messages,
      })
    }

    return Response.json({
      ok: true,
      data: {
        system: {
          cpu: {
            percent: Math.round(cpuPercent * 100) / 100,
            usage: cpuUsage,
          },
          memory: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            percent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100 * 100) / 100,
          },
        },
        sockets: {
          activeConnections,
          latency: {
            p50: latencyStats.p50,
            p95: latencyStats.p95,
          },
        },
        slowQueries: slowQueries.map(q => ({
          query: q.query,
          duration: q.duration,
          timestamp: q.timestamp.toISOString(),
          model: q.model,
        })),
        topActiveRooms: topActiveRooms.map(r => ({
          roomId: r.roomId,
          roomTitle: r.roomTitle,
          messageCount: r.messageCount,
        })),
        messagesPerMinuteByRoom: messagesPerMinuteByRoom.sort((a, b) => b.messagesPerMinute - a.messagesPerMinute),
      },
    })
  } catch (error: any) {
    console.error('Error fetching telemetry:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

