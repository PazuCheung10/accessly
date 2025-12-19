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
import { logger } from '../src/lib/logger'
import * as Sentry from '@sentry/nextjs'

const dev = env.NODE_ENV !== 'production'
const hostname = env.HOST
const port = env.PORT

// Prepare Next.js app
const nextApp = next({ dev, hostname, port })
const nextHandler = nextApp.getRequestHandler()

async function startServer() {
  try {
    // Initialize Sentry if configured
    if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
      try {
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV || 'development',
          tracesSampleRate: 0, // Disable performance tracing for Phase 1
          enabled: true,
        })
        logger.info({ routeName: 'server_startup' }, 'Sentry initialized')
      } catch (sentryError) {
        logger.warn({ routeName: 'server_startup' }, 'Failed to initialize Sentry')
      }
    }

    // Wait for Next.js to prepare
    await nextApp.prepare()

    // Test database connectivity
    try {
      await prisma.$connect()
      logger.info({ routeName: 'server_startup' }, 'Database connected')
    } catch (error) {
      logger.error(
        { routeName: 'server_startup' },
        error instanceof Error ? error : new Error(String(error)),
        { component: 'database' }
      )
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
      logger.info({ routeName: 'server_startup' }, 'Using Redis adapter for Socket.io')

      const pubClient = new Redis(env.REDIS_URL)
      const subClient = pubClient.duplicate()

      // Test Redis connection
      try {
        await Promise.all([
          pubClient.ping(),
          subClient.ping(),
        ])
        logger.info({ routeName: 'server_startup' }, 'Redis connected')
      } catch (error) {
        logger.error(
          { routeName: 'server_startup' },
          error instanceof Error ? error : new Error(String(error)),
          { component: 'redis' }
        )
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
      logger.info(
        { routeName: 'socket_connection', socketId: socket.id },
        'Socket connected'
      )

      // Handle room join
      socket.on('room:join', async (data: { roomId: string; userId: string }) => {
        const { roomId, userId } = data
        socket.data.userId = userId
        socket.join(roomId)

        try {
          // Broadcast user online to others in the room
          socket.to(roomId).emit('user:online', { userId, socketId: socket.id })

          // Send list of current room members to the joining user
          const socketsInRoom = await io.in(roomId).fetchSockets()
          const userIds = socketsInRoom
            .map((s) => s.data.userId)
            .filter((id): id is string => !!id && id !== userId)

          socket.emit('room:members', userIds)

          logger.info(
            { routeName: 'socket_room_join', socketId: socket.id, userId, roomId },
            'User joined room'
          )
        } catch (error) {
          logger.error(
            { routeName: 'socket_room_join', socketId: socket.id, userId, roomId },
            error instanceof Error ? error : new Error(String(error))
          )
        }
      })

      // Handle room leave
      socket.on('room:leave', async (data: { roomId: string; userId: string }) => {
        const { roomId, userId } = data
        socket.leave(roomId)

        try {
          // Broadcast user offline
          socket.to(roomId).emit('user:offline', { userId })

          logger.info(
            { routeName: 'socket_room_leave', socketId: socket.id, userId, roomId },
            'User left room'
          )
        } catch (error) {
          logger.error(
            { routeName: 'socket_room_leave', socketId: socket.id, userId, roomId },
            error instanceof Error ? error : new Error(String(error))
          )
        }
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

      socket.on('disconnect', (reason) => {
        logger.info(
          { routeName: 'socket_disconnect', socketId: socket.id, userId: socket.data.userId, reason },
          'Socket disconnected'
        )
      })
    })

    // Start HTTP server
    httpServer.listen(port, hostname, () => {
      logger.info(
        { routeName: 'server_startup' },
        `Server ready on http://${hostname}:${port}`
      )
      logger.info(
        { routeName: 'server_startup' },
        'Socket.io available at /socket.io'
      )
      if (dev) {
        logger.info(
          { routeName: 'server_startup' },
          `Running in ${dev ? 'development' : 'production'} mode`
        )
      }
    })

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info({ routeName: 'server_shutdown' }, `Received ${signal}, shutting down gracefully...`)

      httpServer.close(() => {
        logger.info({ routeName: 'server_shutdown' }, 'HTTP server closed')
      })

      io.close(() => {
        logger.info({ routeName: 'server_shutdown' }, 'Socket.io server closed')
      })

      await prisma.$disconnect()
      logger.info({ routeName: 'server_shutdown' }, 'Database connection closed')

      process.exit(0)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  } catch (error) {
    logger.error(
      { routeName: 'server_startup' },
      error instanceof Error ? error : new Error(String(error)),
      { fatal: true }
    )
    
    // Report to Sentry if configured
    if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
      try {
        if (error instanceof Error) {
          Sentry.captureException(error, { level: 'fatal' })
        }
        await Sentry.flush(2000)
      } catch (sentryError) {
        // Ignore Sentry errors during fatal shutdown
      }
    }
    
    process.exit(1)
  }
}

// Start the server
startServer()