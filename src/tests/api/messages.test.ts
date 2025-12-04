import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/chat/messages/route'
import { handlePostMessageCore } from '@/app/api/chat/messages/core'
import { prisma } from '@/lib/prisma'
import { checkMessageRate, RateLimitedError } from '@/lib/rateLimit'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
    },
    roomMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/rateLimit', () => {
  return {
    checkMessageRate: vi.fn().mockResolvedValue(undefined),
    RateLimitedError: class RateLimitedError extends Error {
      name = 'RateLimitedError'
      code = 'RATE_LIMITED'
      status = 429
      constructor(message = 'Rate limit exceeded') {
        super(message)
      }
    },
  }
})

vi.mock('@/lib/io', () => ({
  getIO: vi.fn(() => null),
}))

const { auth } = await import('@/lib/auth')

describe('GET /api/chat/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error for unauthorized request', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages?roomId=room-1')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('should return error if roomId is missing', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    const request = new Request('http://localhost/api/chat/messages')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('MISSING_PARAMETER')
    expect(data.message).toContain('roomId')
  })

  it('should return error if user is not a room member', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)
    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'room-1',
      type: 'PUBLIC',
      isPrivate: false,
    } as any)
    vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages?roomId=room-1')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('FORBIDDEN')
    expect(data.message).toContain('Not a member')
  })

  it('should return messages for valid request', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        roomId: 'room-1',
        userId: 'user-1',
        content: 'Hello',
        createdAt: new Date('2025-11-03T01:57:47.417Z'),
        user: { id: 'user-1', name: 'User 1', image: null },
      },
    ]

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)
    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'room-1',
      type: 'PUBLIC',
      isPrivate: false,
    } as any)
    vi.mocked(prisma.roomMember.findUnique).mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      roomId: 'room-1',
      role: 'MEMBER',
    } as any)

    vi.mocked(prisma.message.findMany).mockResolvedValue(mockMessages as any)

    const request = new Request('http://localhost/api/chat/messages?roomId=room-1&limit=20')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data).toBeDefined()
    expect(data.data.messages).toBeDefined()
    expect(Array.isArray(data.data.messages)).toBe(true)
    if (data.data.messages.length > 0) {
      expect(data.data.messages[0]).toMatchObject({
        id: mockMessages[0].id,
        roomId: mockMessages[0].roomId,
        userId: mockMessages[0].userId,
        content: mockMessages[0].content,
        user: mockMessages[0].user,
      })
    }
    expect(prisma.message.findMany).toHaveBeenCalled()
  })
})

  describe('POST /api/chat/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock prisma.user.findUnique for all POST tests
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)
    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'room-1',
      type: 'PUBLIC',
      isPrivate: false,
    } as any)
    // Default: checkMessageRate resolves (no rate limit)
    vi.mocked(checkMessageRate).mockReturnValue(undefined)
  })

  it('should return error for unauthorized request', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ roomId: 'clx1234567890123456789012', content: 'Hello' }),
    })

    const response = await handlePostMessageCore(request)
    expect(response.status).toBe(401)
    expect(response.body.ok).toBe(false)
    expect(response.body.code).toBe('UNAUTHORIZED')
  })

      it('should return error when rate limited (429)', async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
          expires: new Date().toISOString(),
        } as any)

        vi.mocked(prisma.user.findUnique).mockResolvedValue({
          id: 'user-1',
          email: 'test@example.com',
        } as any)

        const rateLimitError = new RateLimitedError('Rate limit exceeded')
        
        vi.mocked(checkMessageRate).mockImplementationOnce(() => {
          throw rateLimitError
        })

    const request = new Request('http://localhost/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        roomId: 'clx1234567890123456789012', 
        content: 'Hello' 
      }),
    })

    const response = await handlePostMessageCore(request)
    expect(response.status).toBe(429)
    expect(response.body.ok).toBe(false)
    expect(response.body.code).toBe('RATE_LIMITED')
    expect(response.body.message).toContain('Rate limit exceeded')
  })

  it('should return 400 error for invalid payload', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)

    const request = new Request('http://localhost/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'invalid-cuid', content: '' }),
    })

    const response = await handlePostMessageCore(request)
    expect(response.status).toBe(400)
    expect(response.body.ok).toBe(false)
    expect(response.body.code).toBe('VALIDATION_ERROR')
    expect(response.body.details).toBeDefined()
  })

  it('should return error if user is not a room member', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)
    vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'clx1234567890123456789012',
        content: 'Hello',
      }),
    })

    const response = await handlePostMessageCore(request)
    expect(response.status).toBe(403)
    expect(response.body.ok).toBe(false)
    expect(response.body.code).toBe('FORBIDDEN')
    expect(response.body.message).toContain('Not a member')
  })

  it('should create message and return success', async () => {
    const mockMessage = {
      id: 'msg-1',
      roomId: 'clx1234567890123456789012',
      userId: 'user-1',
      content: 'Hello',
      createdAt: new Date('2025-11-03T01:57:47.426Z'),
      user: { id: 'user-1', name: 'User 1', image: null },
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as any)

    vi.mocked(prisma.roomMember.findUnique).mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      roomId: 'clx1234567890123456789012',
      role: 'MEMBER',
    } as any)

    vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any)

    const request = new Request('http://localhost/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'clx1234567890123456789012',
        content: 'Hello',
      }),
    })

    const response = await handlePostMessageCore(request)
    expect(response.status).toBe(201)
    expect(response.body.ok).toBe(true)
    expect(response.body.data).toBeDefined()
    // Date gets serialized to ISO string in JSON response
    expect(response.body.data).toMatchObject({
      id: mockMessage.id,
      roomId: mockMessage.roomId,
      userId: mockMessage.userId,
      content: mockMessage.content,
      user: mockMessage.user,
    })
    expect(response.body.data.createdAt).toBeDefined()
    expect(prisma.message.create).toHaveBeenCalled()
  })
})