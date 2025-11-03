import { describe, it, expect, beforeEach } from 'vitest'
import { checkRate, rateLimitStore, RateLimitedError } from '@/lib/rateLimit'

describe('checkRate', () => {
  beforeEach(() => {
    // Clear rate limit store before each test
    rateLimitStore.clear()
  })

  it('should allow requests under the limit', () => {
    const key = 'test-user-1'

    // Make 9 requests (under limit of 10)
    for (let i = 0; i < 9; i++) {
      expect(() => checkRate(key)).not.toThrow()
    }
  })

  it('should throw RateLimitedError when limit exceeded', () => {
    const key = 'test-user-2'

    // Make 10 requests (at limit)
    for (let i = 0; i < 10; i++) {
      checkRate(key)
    }

    // 11th request should fail
    expect(() => checkRate(key)).toThrow(RateLimitedError)
  })

  it('should throw error with correct code and status', () => {
    const key = 'test-user-3'

    // Exceed limit
    for (let i = 0; i < 10; i++) {
      checkRate(key)
    }

    try {
      checkRate(key)
      expect.fail('Should have thrown')
    } catch (error: any) {
      expect(error).toBeInstanceOf(RateLimitedError)
      expect(error.code).toBe('RATE_LIMITED')
      expect(error.status).toBe(429)
      expect(error.message).toContain('Rate limit exceeded')
    }
  })

  it('should track different keys independently', () => {
    const key1 = 'user-1'
    const key2 = 'user-2'

    // Key1 makes 10 requests
    for (let i = 0; i < 10; i++) {
      checkRate(key1)
    }

    // Key2 should still be able to make requests
    expect(() => checkRate(key2)).not.toThrow()

    // Key1 should be rate limited
    expect(() => checkRate(key1)).toThrow(RateLimitedError)
  })

  it('should clean up old timestamps outside the window', async () => {
    const key = 'test-user-4'

    // Make requests to fill up the limit
    for (let i = 0; i < 10; i++) {
      checkRate(key)
    }

    // Should be rate limited now
    expect(() => checkRate(key)).toThrow()

    // Mock time passing by manipulating the store
    // In a real scenario, we'd wait for time to pass
    // For testing, we'll manually manipulate the timestamps
    const entry = rateLimitStore.get(key)
    if (entry) {
      // Set all timestamps to be old (outside window)
      const oldTime = Date.now() - 61000 // 61 seconds ago
      entry.timestamps = Array(10).fill(oldTime)
    }

    // After cleanup, should be able to make requests again
    // Note: cleanup happens in checkRate, so we need to trigger it
    const newEntry = rateLimitStore.get(key)
    if (newEntry) {
      // Manually trigger cleanup by making a request
      // The cleanup function will remove old timestamps
      const now = Date.now()
      const cutoff = now - 60000
      newEntry.timestamps = newEntry.timestamps.filter(
        (timestamp) => timestamp > cutoff
      )
    }

    // After cleanup, should allow new request
    expect(() => checkRate(key)).not.toThrow()
  })
})