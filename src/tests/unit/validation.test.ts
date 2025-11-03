import { describe, it, expect } from 'vitest'
import { MessageInput, Pagination } from '@/lib/validation'

describe('MessageInput validation', () => {
  it('should validate valid message input', () => {
    const valid = {
      roomId: 'clx1234567890123456789012',
      content: 'Hello, world!',
    }

    const result = MessageInput.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(valid)
    }
  })

  it('should reject invalid CUID', () => {
    const invalid = {
      roomId: 'not-a-valid-cuid',
      content: 'Hello',
    }

    const result = MessageInput.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should reject empty content', () => {
    const invalid = {
      roomId: 'clx1234567890123456789012',
      content: '',
    }

    const result = MessageInput.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should reject content over 5000 characters', () => {
    const invalid = {
      roomId: 'clx1234567890123456789012',
      content: 'a'.repeat(5001),
    }

    const result = MessageInput.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should accept content exactly 5000 characters', () => {
    const valid = {
      roomId: 'clx1234567890123456789012',
      content: 'a'.repeat(5000),
    }

    const result = MessageInput.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('should reject missing fields', () => {
    const invalid = {
      roomId: 'clx1234567890123456789012',
    }

    const result = MessageInput.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe('Pagination validation', () => {
  it('should validate valid pagination with all fields', () => {
    const valid = {
      cursor: 'clx1234567890123456789012',
      limit: 25,
    }

    const result = Pagination.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(25)
      expect(result.data.cursor).toBe('clx1234567890123456789012')
    }
  })

  it('should use default limit of 20', () => {
    const valid = {
      cursor: 'clx1234567890123456789012',
    }

    const result = Pagination.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(20)
    }
  })

  it('should allow missing cursor', () => {
    const valid = {
      limit: 30,
    }

    const result = Pagination.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(30)
      expect(result.data.cursor).toBeUndefined()
    }
  })

  it('should reject limit below 1', () => {
    const invalid = {
      limit: 0,
    }

    const result = Pagination.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should reject limit over 50', () => {
    const invalid = {
      limit: 51,
    }

    const result = Pagination.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should accept limit exactly 50', () => {
    const valid = {
      limit: 50,
    }

    const result = Pagination.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
    }
  })
})