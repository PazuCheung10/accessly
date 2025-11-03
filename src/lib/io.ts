/**
 * Socket.io singleton accessor
 * Provides access to the Socket.io server instance created in the custom Node server
 */

import { Server as SocketIOServer } from 'socket.io'

const g = globalThis as unknown as { _io?: SocketIOServer }

/**
 * Set the Socket.io server instance (called from server/index.ts)
 */
export function setIO(io: SocketIOServer): void {
  g._io = io
}

/**
 * Get the Socket.io server instance
 * Returns undefined if server hasn't been initialized (e.g., in test environment)
 */
export function getIO(): SocketIOServer | undefined {
  return g._io
}
