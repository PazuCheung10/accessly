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
  })

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id)
  })

  socket.on('disconnect', () => {
    console.log('Socket disconnected')
  })

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error)
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