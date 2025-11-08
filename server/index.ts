/**
 * Custom Node.js HTTP server with Socket.io
 * Runs Next.js app and attaches Socket.io to the same HTTP server
 */

import { createServer } from 'http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { prisma } from '../src/lib/prisma'
import { setIO } from '../src/lib/io'
import { setTelemetryIO, trackRoomMessage } from '../src/lib/telemetry'
import { env } from '../src/lib/env'

const dev = env.NODE_ENV !== 'production'
const hostname = env.HOST
const port = env.PORT

// Prepare Next.js app
const nextApp = next({ dev, hostname, port })
const nextHandler = nextApp.getRequestHandler()

async function startServer() {
  try {
    // Wait for Next.js to prepare
    await nextApp.prepare()

    // Test database connectivity
    try {
      await prisma.$connect()
      console.log('✅ Database connected')
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      // Don't exit - let the app start but log the error
    }

    // Create HTTP server
    const httpServer = createServer((req, res) => {
      nextHandler(req, res)
    })

    // Initialize Socket.io
    let io: SocketIOServer

    if (env.REDIS_URL) {
      // Use Redis adapter for horizontal scaling
      console.log('🔴 Using Redis adapter for Socket.io')

      const pubClient = new Redis(env.REDIS_URL)
      const subClient = pubClient.duplicate()

      // Test Redis connection
      try {
        await Promise.all([
          pubClient.ping(),
          subClient.ping(),
        ])
        console.log('✅ Redis connected')
      } catch (error) {
        console.error('❌ Redis connection failed:', error)
        throw error
      }

      io = new SocketIOServer(httpServer, {
        path: '/socket.io',
        addTrailingSlash: false,
        cors: {
          origin: env.NEXT_PUBLIC_APP_URL || '*',
          methods: ['GET', 'POST'],
          credentials: true,
        },
        adapter: createAdapter(pubClient, subClient),
      })
    } else {
      // Standalone Socket.io server (single instance)
      io = new SocketIOServer(httpServer, {
        path: '/socket.io',
        addTrailingSlash: false,
        cors: {
          origin: env.NEXT_PUBLIC_APP_URL || '*',
          methods: ['GET', 'POST'],
          credentials: true,
        },
      })
    }

    // Set singleton for API routes to access
    setIO(io)
    setTelemetryIO(io)

    // Socket.io connection handlers
    io.on('connection', (socket) => {
      console.log('🔌 Socket connected:', socket.id)

      // Handle room join
      socket.on('room:join', async (data: { roomId: string; userId: string }) => {
        const { roomId, userId } = data
        socket.data.userId = userId
        socket.join(roomId)

        // Broadcast user online to others in the room
        socket.to(roomId).emit('user:online', { userId, socketId: socket.id })

        // Send list of current room members to the joining user
        const socketsInRoom = await io.in(roomId).fetchSockets()
        const userIds = socketsInRoom
          .map((s) => s.data.userId)
          .filter((id): id is string => !!id && id !== userId)

        socket.emit('room:members', userIds)

        console.log(`👤 User ${userId} joined room ${roomId}`)
      })

      // Handle room leave
      socket.on('room:leave', async (data: { roomId: string; userId: string }) => {
        const { roomId, userId } = data
        socket.leave(roomId)

        // Broadcast user offline
        socket.to(roomId).emit('user:offline', { userId })

        console.log(`👋 User ${userId} left room ${roomId}`)
      })

      // Handle typing indicators
      socket.on('typing:start', (data: { roomId: string; userId: string; userName: string }) => {
        const { roomId, userId, userName } = data
        // Broadcast to others in the room (not the sender)
        socket.to(roomId).emit('typing:start', { userId, userName })
      })

      socket.on('typing:stop', (data: { roomId: string; userId: string }) => {
        const { roomId, userId } = data
        // Broadcast to others in the room (not the sender)
        socket.to(roomId).emit('typing:stop', { userId })
      })

      // Track socket latency with ping/pong
      socket.on('ping', (startTime: number) => {
        const latency = Date.now() - startTime
        const { trackSocketLatency } = require('../src/lib/telemetry')
        trackSocketLatency(latency)
        socket.emit('pong', Date.now())
      })

      socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected:', socket.id)
      })
    })

    // Start HTTP server
    httpServer.listen(port, hostname, () => {
      console.log(`🚀 Server ready on http://${hostname}:${port}`)
      console.log(`📡 Socket.io available at /socket.io`)
      if (dev) {
        console.log(`🔧 Running in ${dev ? 'development' : 'production'} mode`)
      }
    })

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)

      httpServer.close(() => {
        console.log('✅ HTTP server closed')
      })

      io.close(() => {
        console.log('✅ Socket.io server closed')
      })

      await prisma.$disconnect()
      console.log('✅ Database connection closed')

      process.exit(0)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
startServer()