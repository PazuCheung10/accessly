import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/chat/messages/route'
import { prisma } from '@/lib/prisma'
import { checkRate } from '@/lib/rateLimit'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    roomMember: {
      findUnique: vi.fn(),
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

vi.mock('@/lib/rateLimit', () => ({
  checkRate: vi.fn(),
}))

vi.mock('@/lib/socket-server', () => ({
  getSocketIO: vi.fn(() => null),
}))

const { auth } = await import('@/lib/auth')

describe('GET /api/chat/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error for unauthorized request', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages?roomId=test')
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
      user: { id: 'user-1', role: 'USER' },
      expires: new Date().toISOString(),
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
      user: { id: 'user-1', role: 'USER' },
      expires: new Date().toISOString(),
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
  })

  it('should return error for unauthorized request', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ roomId: 'room-1', content: 'Hello' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('should return error when rate limited', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    const rateLimitError = new Error('Rate limit exceeded')
    ;(rateLimitError as any).code = 'RATE_LIMITED'
    vi.mocked(checkRate).mockImplementation(() => {
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

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('RATE_LIMITED')
  })

  it('should return error for invalid input', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(checkRate).mockReturnValue(undefined)

    const request = new Request('http://localhost/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ roomId: 'invalid', content: '' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('should return error if user is not a room member', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(checkRate).mockReturnValue(undefined)
    vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'clx1234567890123456789012',
        content: 'Hello',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('FORBIDDEN')
    expect(data.message).toContain('Not a member')
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
      user: { id: 'user-1', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(checkRate).mockReturnValue(undefined)

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

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data).toBeDefined()
    // Date gets serialized to ISO string in JSON response
    expect(data.data).toMatchObject({
      id: mockMessage.id,
      roomId: mockMessage.roomId,
      userId: mockMessage.userId,
      content: mockMessage.content,
      user: mockMessage.user,
    })
    expect(data.data.createdAt).toBeDefined()
    expect(prisma.message.create).toHaveBeenCalled()
  })
})