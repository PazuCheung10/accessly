/**
 * Naive in-memory rate limiter using sliding window algorithm
 *
 * TODO: Replace with Redis-based rate limiter for production
 * - In-memory store doesn't work across multiple server instances
 * - Data is lost on server restart
 * - Memory usage grows unbounded (no cleanup of old entries)
 * - Consider using: @upstash/ratelimit or similar Redis-based solution
 */

export class RateLimitedError extends Error {
  code = 'RATE_LIMITED'
  status = 429

  constructor(message = 'Rate limit exceeded') {
    super(message)
    this.name = 'RateLimitedError'
  }
}

interface RateLimitEntry {
  timestamps: number[]
}

// In-memory store: key -> array of request timestamps
// Exported for testing purposes
export const rateLimitStore = new Map<string, RateLimitEntry>()

// Configuration
const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS = 10 // max 10 requests per minute

// Message rate limiting configuration
const MESSAGE_WINDOW_MS = 5 * 1000 // 5 seconds
const MAX_MESSAGES = 3 // max 3 messages per 5 seconds

/**
 * Clean up old timestamps outside the window
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
  const now = Date.now()
  let entry = rateLimitStore.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    rateLimitStore.set(key, entry)
  }

  // Clean up old timestamps outside the window
  cleanupTimestamps(entry, now)

  // Check if limit exceeded
  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestTimestamp = entry.timestamps[0]
    const timeUntilReset = oldestTimestamp + WINDOW_MS - now
    throw new RateLimitedError(
      `Rate limit exceeded. Try again in ${Math.ceil(timeUntilReset / 1000)} seconds.`
    )
  }

  // Record this request
  entry.timestamps.push(now)
}

/**
 * Check if the key has exceeded the message rate limit
 * @param key - Unique identifier for the rate limit (e.g., user ID, IP address)
 * @throws RateLimitedError if rate limit exceeded
 */
export function checkMessageRate(key: string): void {
  const now = Date.now()
  const messageKey = `message:${key}`
  let entry = rateLimitStore.get(messageKey)

  if (!entry) {
    entry = { timestamps: [] }
    rateLimitStore.set(messageKey, entry)
  }

  // Clean up old timestamps outside the window
  const cutoff = now - MESSAGE_WINDOW_MS
  entry.timestamps = entry.timestamps.filter((timestamp) => timestamp > cutoff)

  // Check if limit exceeded
  if (entry.timestamps.length >= MAX_MESSAGES) {
    const oldestTimestamp = entry.timestamps[0]
    const timeUntilReset = oldestTimestamp + MESSAGE_WINDOW_MS - now
    throw new RateLimitedError(
      `You're sending messages too fast. Please wait ${Math.ceil(timeUntilReset / 1000)} seconds.`
    )
  }

  // Record this request
  entry.timestamps.push(now)
}

/**
 * Check rate limit for support form submissions
 * Uses IP address as key (for anonymous users)
 * @param key - IP address or user identifier
 * @throws RateLimitedError if rate limit exceeded
 */
export function checkSupportFormRate(key: string): void {
  const now = Date.now()
  const supportKey = `support:${key}`
  let entry = rateLimitStore.get(supportKey)

  if (!entry) {
    entry = { timestamps: [] }
    rateLimitStore.set(supportKey, entry)
  }

  // Clean up old timestamps outside the window (5 minutes for support forms)
  const SUPPORT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
  const MAX_SUPPORT_REQUESTS = 3 // max 3 submissions per 5 minutes
  const cutoff = now - SUPPORT_WINDOW_MS
  entry.timestamps = entry.timestamps.filter((timestamp) => timestamp > cutoff)

  // Check if limit exceeded
  if (entry.timestamps.length >= MAX_SUPPORT_REQUESTS) {
    const oldestTimestamp = entry.timestamps[0]
    const timeUntilReset = oldestTimestamp + SUPPORT_WINDOW_MS - now
    throw new RateLimitedError(
      `You're submitting support requests too fast. Please wait ${Math.ceil(timeUntilReset / 1000)} seconds.`
    )
  }

  // Record this request
  entry.timestamps.push(now)
}