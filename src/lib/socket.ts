/**
 * Socket.io client helper
 * Creates and manages the client socket connection
 */

'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * Initialize Socket.io client connection
 * @param userId - Current user ID
 */
export function initSocket(userId: string): Socket {
  if (socket?.connected) {
    return socket
  }

  socket = io(window.location.origin, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    timeout: 5000, // Reduce from default ~20s to 5s for faster failure detection
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 3, // Limit reconnection attempts to prevent infinite retries
  })

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket?.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('⚠️ Socket disconnected:', reason)
  })

  socket.on('connect_error', (error) => {
    // Log as warning instead of error to prevent Next.js dev overlay from showing
    // This makes the connection failure non-blocking
    console.warn('⚠️ Socket connection error (non-blocking):', error.message)
    // Don't throw or re-throw - just log and let the app continue working
  })

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`🔄 Socket reconnection attempt ${attemptNumber}`)
  })

  socket.on('reconnect_failed', () => {
    console.warn('⚠️ Socket reconnection failed after all attempts - app will continue without realtime features')
  })

  return socket
}

/**
 * Get the current socket instance
 */
export function getSocket(): Socket | null {
  return socket
}

/**
 * Disconnect the socket
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}