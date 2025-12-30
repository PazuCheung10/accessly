import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // NextAuth
  AUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),

  // GitHub OAuth (optional)
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),

  // Email provider (optional)
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Socket.io Redis adapter (optional, for production scaling)
  REDIS_URL: z.string().url().optional(),

  // Server configuration
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),

  // App (optional, public)
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // AI Provider (optional, defaults to 'fake')
  TICKET_AI_PROVIDER: z.enum(['fake', 'openai']).optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Sentry (optional)
  SENTRY_DSN: z.string().url().optional(),
})

// Parse and validate environment variables
function getEnv() {
  // During Next.js build, skip validation for required runtime vars
  // They will be validated at runtime when the server starts
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NEXT_PHASE === 'phase-development-build' ||
                      process.env.NEXT_PHASE === 'phase-export' ||
                      !process.env.DATABASE_URL // If DATABASE_URL is missing, we're likely in build

  if (isBuildTime) {
    // Return a partial env object for build time
    // Required vars will be validated at runtime
    return {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://placeholder:5432/db',
      AUTH_SECRET: process.env.AUTH_SECRET || 'build-time-placeholder-secret',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      GITHUB_ID: process.env.GITHUB_ID,
      GITHUB_SECRET: process.env.GITHUB_SECRET,
      EMAIL_SERVER: process.env.EMAIL_SERVER,
      EMAIL_FROM: process.env.EMAIL_FROM,
      REDIS_URL: process.env.REDIS_URL,
      PORT: Number(process.env.PORT) || 3000,
      HOST: process.env.HOST || '0.0.0.0',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      TICKET_AI_PROVIDER: process.env.TICKET_AI_PROVIDER as 'fake' | 'openai' | undefined,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      SENTRY_DSN: process.env.SENTRY_DSN,
    }
  }

  // At runtime, validate all required variables
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GITHUB_ID: process.env.GITHUB_ID,
    GITHUB_SECRET: process.env.GITHUB_SECRET,
    EMAIL_SERVER: process.env.EMAIL_SERVER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    REDIS_URL: process.env.REDIS_URL,
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    TICKET_AI_PROVIDER: process.env.TICKET_AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
  })

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:')
    const errors = parsed.error.flatten().fieldErrors
    for (const [key, value] of Object.entries(errors)) {
      console.error(`  ${key}: ${value?.join(', ')}`)
    }
    throw new Error(
      'Invalid environment variables. Please check your .env file.'
    )
  }

  return parsed.data
}

export const env = getEnv()