import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/chat/messages/route'
import { prisma } from '@/lib/prisma'
import { checkRate } from '@/lib/rateLimit'
import { MessageInput } from '@/lib/validation'

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

  it('should return 401 for unauthorized request', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages?roomId=test')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 if roomId is missing', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    const request = new Request('http://localhost/api/chat/messages')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('roomId is required')
  })

  it('should return 403 if user is not a room member', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', role: 'USER' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages?roomId=room-1')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Not a member of this room')
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

    const request = new Request('http://localhost/api/chat/messages?roomId=room-1')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    // Date gets serialized to ISO string in JSON response
    expect(data.messages[0]).toMatchObject({
      id: mockMessages[0].id,
      roomId: mockMessages[0].roomId,
      userId: mockMessages[0].userId,
      content: mockMessages[0].content,
      user: mockMessages[0].user,
    })
    expect(data.messages[0].createdAt).toBeDefined()
    expect(prisma.message.findMany).toHaveBeenCalled()
  })
})

describe('POST /api/chat/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 for unauthorized request', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request('http://localhost/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ roomId: 'room-1', content: 'Hello' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 429 when rate limited', async () => {
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

    expect(response.status).toBe(429)
    expect(data.code).toBe('RATE_LIMITED')
  })

  it('should return 400 for invalid input', async () => {
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

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation error')
  })

  it('should return 403 if user is not a room member', async () => {
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

    expect(response.status).toBe(403)
    expect(data.error).toBe('Not a member of this room')
  })

  it('should create message and return 201', async () => {
    const mockMessage = {
      id: 'msg-1',
      roomId: 'clx1234567890123456789012',
      userId: 'user-1',
      content: 'Hello',
      createdAt: new Date(),
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

    expect(response.status).toBe(201)
    // Date gets serialized to ISO string in JSON response
    expect(data.message).toMatchObject({
      id: mockMessage.id,
      roomId: mockMessage.roomId,
      userId: mockMessage.userId,
      content: mockMessage.content,
      user: mockMessage.user,
    })
    expect(data.message.createdAt).toBeDefined()
    expect(prisma.message.create).toHaveBeenCalled()
  })
})