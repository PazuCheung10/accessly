'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface TelemetryData {
  system: {
    cpu: { percent: number; usage: number }
    memory: { used: number; total: number; percent: number }
  }
  sockets: {
    activeConnections: number
    latency: { p50: number; p95: number }
  }
  slowQueries: Array<{
    query: string
    duration: number
    timestamp: string
    model?: string
  }>
  topActiveRooms: Array<{
    roomId: string
    roomTitle: string
    messageCount: number
  }>
  messagesPerMinuteByRoom: Array<{
    roomId: string
    roomTitle: string
    messagesPerMinute: number
  }>
}

interface TimeSeriesPoint {
  timestamp: string
  cpu: number
  memory: number
  connections: number
  latencyP50: number
  latencyP95: number
}

export function TelemetryDashboard() {
  const router = useRouter()
  const [data, setData] = useState<TelemetryData | null>(null)
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTelemetry = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/telemetry', {
        credentials: 'include',
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Failed to fetch telemetry')
      }

      setData(result.data)

      // Add to time series
      const now = new Date().toISOString()
      setTimeSeries((prev) => {
        const newPoint: TimeSeriesPoint = {
          timestamp: now,
          cpu: result.data.system.cpu.percent,
          memory: result.data.system.memory.percent,
          connections: result.data.sockets.activeConnections,
          latencyP50: result.data.sockets.latency.p50,
          latencyP95: result.data.sockets.latency.p95,
        }
        const updated = [...prev, newPoint]
        // Keep last 60 points (5 minutes at 5-second intervals)
        return updated.slice(-60)
      })

      setError(null)
    } catch (err: any) {
      console.error('Error fetching telemetry:', err)
      setError(err.message || 'Failed to fetch telemetry')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTelemetry()
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchTelemetry, 5000)
    return () => clearInterval(interval)
  }, [fetchTelemetry])

  const handleRoomClick = (roomId: string) => {
    router.push(`/chat?room=${roomId}`)
  }

  if (isLoading && !data) {
    return (
      <div className="text-center py-12 text-slate-400">
        Loading telemetry data...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        Error: {error}
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">CPU Usage</div>
          <div className="text-2xl font-bold text-cyan-400">{data.system.cpu.percent.toFixed(1)}%</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Memory Usage</div>
          <div className="text-2xl font-bold text-purple-400">{data.system.memory.percent.toFixed(1)}%</div>
          <div className="text-xs text-slate-500 mt-1">
            {(data.system.memory.used / 1024 / 1024).toFixed(0)} MB / {(data.system.memory.total / 1024 / 1024).toFixed(0)} MB
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Active Connections</div>
          <div className="text-2xl font-bold text-green-400">{data.sockets.activeConnections}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Socket Latency (p95)</div>
          <div className="text-2xl font-bold text-yellow-400">{data.sockets.latency.p95.toFixed(0)}ms</div>
          <div className="text-xs text-slate-500 mt-1">p50: {data.sockets.latency.p50.toFixed(0)}ms</div>
        </div>
      </div>

      {/* Time Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">System Resources (5 min)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                stroke="#9CA3AF"
              />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <Legend />
              <Line type="monotone" dataKey="cpu" stroke="#06B6D4" name="CPU %" />
              <Line type="monotone" dataKey="memory" stroke="#A855F7" name="Memory %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Socket Metrics (5 min)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                stroke="#9CA3AF"
              />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <Legend />
              <Line type="monotone" dataKey="connections" stroke="#10B981" name="Connections" />
              <Line type="monotone" dataKey="latencyP50" stroke="#F59E0B" name="Latency p50 (ms)" />
              <Line type="monotone" dataKey="latencyP95" stroke="#EF4444" name="Latency p95 (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Active Rooms */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Top 5 Active Rooms (Last Minute)</h3>
        {data.topActiveRooms.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.topActiveRooms}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="roomTitle"
                angle={-45}
                textAnchor="end"
                height={100}
                stroke="#9CA3AF"
              />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
              />
              <Bar dataKey="messageCount" fill="#06B6D4" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-slate-400">No active rooms</div>
        )}
        <div className="mt-4 space-y-2">
          {data.topActiveRooms.map((room) => (
            <button
              key={room.roomId}
              onClick={() => handleRoomClick(room.roomId)}
              className="w-full text-left px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{room.roomTitle}</span>
                <span className="text-sm text-slate-400">{room.messageCount} messages</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Slow Queries */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Top 5 Slowest Prisma Queries</h3>
        {data.slowQueries.length > 0 ? (
          <div className="space-y-2">
            {data.slowQueries.map((query, index) => (
              <div
                key={index}
                className="bg-slate-700/50 rounded p-3 border border-slate-600"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm text-cyan-400">{query.query}</span>
                  <span className="text-sm font-semibold text-red-400">{query.duration}ms</span>
                </div>
                {query.model && (
                  <div className="text-xs text-slate-400">Model: {query.model}</div>
                )}
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(query.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">No slow queries detected</div>
        )}
      </div>

      {/* Messages Per Minute */}
      {data.messagesPerMinuteByRoom.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Messages Per Minute by Room</h3>
          <div className="space-y-2">
            {data.messagesPerMinuteByRoom.slice(0, 10).map((room) => (
              <button
                key={room.roomId}
                onClick={() => handleRoomClick(room.roomId)}
                className="w-full text-left px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{room.roomTitle}</span>
                  <span className="text-sm text-slate-400">{room.messagesPerMinute.toFixed(1)} msg/min</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

