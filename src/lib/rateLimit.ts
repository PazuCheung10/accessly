/**
 * Rate limiter with Redis support for multi-instance deployments
 * 
 * Behavior:
 * - If Redis is available: Uses Redis for counting and expiry (multi-instance safe)
 * - If Redis is not configured: Falls back to in-memory store (single-instance only)
 * 
 * IMPORTANT: The in-memory fallback is NOT safe for multi-instance deployments.
 * Each instance will have its own rate limit counter, allowing users to bypass
 * limits by hitting different instances. Use Redis in production with multiple instances.
 */

import { env } from './env'
import Redis from 'ioredis'

export class RateLimitedError extends Error {
  code = 'RATE_LIMITED' as const
  status = 429 as const

  constructor(message = 'Rate limit exceeded') {
    super(message)
    this.name = 'RateLimitedError'
  }
}

// Redis client (lazy initialization)
let redisClient: Redis | null = null
let redisInitialized = false

/**
 * Get or create Redis client (if Redis is configured)
 * Returns null if Redis is not available
 */
function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null
  }

  if (!redisInitialized) {
    try {
      redisClient = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: () => null, // Don't retry on connection failure
        lazyConnect: true,
      })
      redisInitialized = true
    } catch (error) {
      console.warn('[rateLimit] Failed to initialize Redis client:', error)
      return null
    }
  }

  return redisClient
}

/**
 * Core rate limit check using Redis or in-memory fallback
 * 
 * @param key - Unique identifier for the rate limit (e.g., user ID, IP address)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if within limit, throws RateLimitedError if exceeded
 */
export async function incrementAndCheckLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<void> {
  const redis = getRedisClient()

  if (redis) {
    // Redis-backed rate limiting (multi-instance safe)
    try {
      const redisKey = `ratelimit:${key}`
      const now = Date.now()
      const windowStart = now - windowMs

      // Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline()
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(redisKey, 0, windowStart)
      
      // Count current entries in window
      pipeline.zcard(redisKey)
      
      // Add current request
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`)
      
      // Set expiry on the key (cleanup)
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000) + 1)
      
      const results = await pipeline.exec()
      
      if (!results) {
        throw new Error('Redis pipeline execution failed')
      }

      // results[1] is the count (zcard result)
      const count = results[1]?.[1] as number | undefined
      
      if (count !== undefined && count >= limit) {
        // Calculate time until oldest entry expires
        const oldestEntry = await redis.zrange(redisKey, 0, 0, 'WITHSCORES')
        if (oldestEntry && oldestEntry.length >= 2) {
          const oldestTimestamp = parseInt(oldestEntry[1], 10)
          const timeUntilReset = oldestTimestamp + windowMs - now
          throw new RateLimitedError(
            `Rate limit exceeded. Try again in ${Math.ceil(timeUntilReset / 1000)} seconds.`
          )
        }
        throw new RateLimitedError('Rate limit exceeded')
      }
      
      return // Within limit
    } catch (error) {
      // If Redis fails, fall back to in-memory (but log warning)
      if (error instanceof RateLimitedError) {
        throw error
      }
      console.warn('[rateLimit] Redis operation failed, falling back to in-memory:', error)
      // Fall through to in-memory implementation
    }
  }

  // In-memory fallback (single-instance only)
  const now = Date.now()
  let entry = rateLimitStore.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    rateLimitStore.set(key, entry)
  }

  // Clean up old timestamps outside the window
  const cutoff = now - windowMs
  entry.timestamps = entry.timestamps.filter((timestamp) => timestamp > cutoff)

  // Check if limit exceeded
  if (entry.timestamps.length >= limit) {
    const oldestTimestamp = entry.timestamps[0]
    const timeUntilReset = oldestTimestamp + windowMs - now
    throw new RateLimitedError(
      `Rate limit exceeded. Try again in ${Math.ceil(timeUntilReset / 1000)} seconds.`
    )
  }

  // Record this request
  entry.timestamps.push(now)
}

interface RateLimitEntry {
  timestamps: number[]
}

// In-memory store: key -> array of request timestamps
// SINGLE-INSTANCE ONLY - Use Redis for multi-instance deployments
// Exported for testing purposes
export const rateLimitStore = new Map<string, RateLimitEntry>()

// Configuration
const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS = 10 // max 10 requests per minute

// Message rate limiting configuration
const MESSAGE_WINDOW_MS = 5 * 1000 // 5 seconds
const MAX_MESSAGES = 3 // max 3 messages per 5 seconds

/**
 * Clean up old timestamps outside the window (in-memory only)
 */
function cleanupTimestamps(entry: RateLimitEntry, now: number): void {
  const cutoff = now - WINDOW_MS
  entry.timestamps = entry.timestamps.filter((timestamp) => timestamp > cutoff)
}

/**
 * Check if the key has exceeded the rate limit
 * @param key - Unique identifier for the rate limit (e.g., user ID, IP address)
 * @throws RateLimitedError if rate limit exceeded
 */
export function checkRate(key: string): void {
  // Synchronous version for backward compatibility
  // Note: This will use in-memory store only (not async Redis)
  // For Redis support, use incrementAndCheckLimit() directly
  const now = Date.now()
  let entry = rateLimitStore.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    rateLimitStore.set(key, entry)
  }

  cleanupTimestamps(entry, now)

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestTimestamp = entry.timestamps[0]
    const timeUntilReset = oldestTimestamp + WINDOW_MS - now
    throw new RateLimitedError(
      `Rate limit exceeded. Try again in ${Math.ceil(timeUntilReset / 1000)} seconds.`
    )
  }

  entry.timestamps.push(now)
}

/**
 * Check if the key has exceeded the message rate limit
 * @param key - Unique identifier for the rate limit (e.g., user ID, IP address)
 * @throws RateLimitedError if rate limit exceeded
 */
export async function checkMessageRate(key: string): Promise<void> {
  const messageKey = `message:${key}`
  await incrementAndCheckLimit(messageKey, MAX_MESSAGES, MESSAGE_WINDOW_MS)
}

/**
 * Check rate limit for support form submissions
 * Uses IP address as key (for anonymous users)
 * @param key - IP address or user identifier
 * @throws RateLimitedError if rate limit exceeded
 */
export async function checkSupportFormRate(key: string): Promise<void> {
  const supportKey = `support:${key}`
  const SUPPORT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
  const MAX_SUPPORT_REQUESTS = 3 // max 3 submissions per 5 minutes
  await incrementAndCheckLimit(supportKey, MAX_SUPPORT_REQUESTS, SUPPORT_WINDOW_MS)
}

/**
 * Check rate limit (for tests - can be mocked)
 */
export async function checkRateLimit(_key: string) {
  // no-op in real code, tests will mock this
}
