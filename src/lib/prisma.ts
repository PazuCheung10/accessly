import { PrismaClient } from '@prisma/client'
import { env } from './env'
import { metricsStore } from './metrics'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Add middleware to track slow queries
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  const duration = after - before

  // Track queries slower than 100ms
  if (duration > 100) {
    metricsStore.addSlowQuery({
      query: `${params.model}.${params.action}`,
      duration,
      timestamp: new Date(),
      model: params.model,
    })
  }

  return result
})

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma