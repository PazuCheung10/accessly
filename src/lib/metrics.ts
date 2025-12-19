/**
 * Metrics collection service
 * Tracks various system metrics for observability dashboard
 * 
 * NOTE: Metrics are approximate and for debugging purposes only, not strict SLAs.
 * In-memory storage means metrics are lost on restart and not shared across instances.
 * For production multi-instance deployments, consider Redis-backed counters.
 */

interface QueryMetric {
  query: string
  duration: number
  timestamp: Date
  model?: string
}

interface RoomActivity {
  roomId: string
  roomTitle: string
  messageCount: number
  timestamp: Date
}

interface SocketLatency {
  timestamp: Date
  latency: number
}

// In-memory metrics storage (in production, consider Redis or a time-series DB)
class MetricsStore {
  private slowQueries: QueryMetric[] = []
  private roomActivity: Map<string, RoomActivity[]> = new Map()
  private socketLatencies: SocketLatency[] = []
  private maxSlowQueries = 100
  private maxLatencies = 1000

  // Phase 3: Simple counters for operational metrics
  // These are approximate counters for debugging, not strict SLAs
  private error5xxCount = 0 // Total 5xx errors
  private error5xxByRoute = new Map<string, number>() // 5xx errors per route
  private aiFailureCount = 0 // AI assistant failures
  private socketConnectCount = 0 // Socket connections
  private socketDisconnectCount = 0 // Socket disconnections

  addSlowQuery(metric: QueryMetric) {
    this.slowQueries.push(metric)
    // Keep only the slowest queries
    this.slowQueries.sort((a, b) => b.duration - a.duration)
    if (this.slowQueries.length > this.maxSlowQueries) {
      this.slowQueries = this.slowQueries.slice(0, this.maxSlowQueries)
    }
  }

  addRoomActivity(roomId: string, activity: RoomActivity) {
    if (!this.roomActivity.has(roomId)) {
      this.roomActivity.set(roomId, [])
    }
    const activities = this.roomActivity.get(roomId)!
    activities.push(activity)
    // Keep last 60 minutes of activity (assuming 1-minute intervals)
    const cutoff = new Date(Date.now() - 60 * 60 * 1000)
    const filtered = activities.filter(a => a.timestamp > cutoff)
    this.roomActivity.set(roomId, filtered)
  }

  addSocketLatency(latency: number) {
    this.socketLatencies.push({
      timestamp: new Date(),
      latency,
    })
    // Keep last 1000 measurements
    if (this.socketLatencies.length > this.maxLatencies) {
      this.socketLatencies = this.socketLatencies.slice(-this.maxLatencies)
    }
  }

  getSlowQueries(limit: number = 5): QueryMetric[] {
    return this.slowQueries.slice(0, limit)
  }

  getRoomActivity(roomId?: string): RoomActivity[] {
    if (roomId) {
      return this.roomActivity.get(roomId) || []
    }
    // Aggregate all rooms
    const all: RoomActivity[] = []
    for (const activities of this.roomActivity.values()) {
      all.push(...activities)
    }
    return all
  }

  getMessagesPerMinute(roomId?: string): number {
    const activities = this.getRoomActivity(roomId)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    const recent = activities.filter(a => a.timestamp > oneMinuteAgo)
    return recent.reduce((sum, a) => sum + a.messageCount, 0)
  }

  getSocketLatencyStats(): { p50: number; p95: number } {
    if (this.socketLatencies.length === 0) {
      return { p50: 0, p95: 0 }
    }

    const latencies = [...this.socketLatencies]
      .map(l => l.latency)
      .sort((a, b) => a - b)

    const p50Index = Math.floor(latencies.length * 0.5)
    const p95Index = Math.floor(latencies.length * 0.95)

    return {
      p50: latencies[p50Index] || 0,
      p95: latencies[p95Index] || 0,
    }
  }

  getTopActiveRooms(limit: number = 5): Array<{ roomId: string; roomTitle: string; messageCount: number }> {
    const roomTotals = new Map<string, { roomTitle: string; messageCount: number }>()
    
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    
    for (const [roomId, activities] of this.roomActivity.entries()) {
      const recent = activities.filter(a => a.timestamp > oneMinuteAgo)
      const total = recent.reduce((sum, a) => sum + a.messageCount, 0)
      
      if (total > 0 && recent.length > 0) {
        roomTotals.set(roomId, {
          roomTitle: recent[0].roomTitle,
          messageCount: total,
        })
      }
    }

    return Array.from(roomTotals.entries())
      .map(([roomId, data]) => ({ roomId, ...data }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, limit)
  }

  // Phase 3: Increment 5xx error counter
  increment5xxError(routeName?: string) {
    this.error5xxCount++
    if (routeName) {
      const current = this.error5xxByRoute.get(routeName) || 0
      this.error5xxByRoute.set(routeName, current + 1)
    }
  }

  // Phase 3: Increment AI failure counter
  incrementAIFailure() {
    this.aiFailureCount++
  }

  // Phase 3: Increment socket connection counter
  incrementSocketConnect() {
    this.socketConnectCount++
  }

  // Phase 3: Increment socket disconnection counter
  incrementSocketDisconnect() {
    this.socketDisconnectCount++
  }

  // Phase 3: Get operational metrics snapshot
  getOperationalMetrics() {
    return {
      error5xxTotal: this.error5xxCount,
      error5xxByRoute: Object.fromEntries(this.error5xxByRoute),
      aiFailures: this.aiFailureCount,
      socketConnects: this.socketConnectCount,
      socketDisconnects: this.socketDisconnectCount,
    }
  }
}

// Singleton instance
export const metricsStore = new MetricsStore()

