/**
 * Telemetry utilities for tracking socket connections and latency
 */

import { Server as SocketIOServer } from 'socket.io'
import { metricsStore } from './metrics'

let ioInstance: SocketIOServer | null = null

export function setTelemetryIO(io: SocketIOServer) {
  ioInstance = io
}

export function getActiveSocketConnections(): number {
  if (!ioInstance) return 0
  return ioInstance.sockets.sockets.size
}

export function trackSocketLatency(latency: number) {
  metricsStore.addSocketLatency(latency)
}

// Track message activity per room
export function trackRoomMessage(roomId: string, roomTitle: string) {
  metricsStore.addRoomActivity(roomId, {
    roomId,
    roomTitle,
    messageCount: 1,
    timestamp: new Date(),
  })
}

