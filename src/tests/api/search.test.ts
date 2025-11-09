import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/search/route'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    message: {
      findMany: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

describe('POST /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should require authentication', async () => {
    ;(auth as any).mockResolvedValue(null)

    const request = new Request('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('should search messages with full-text search', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'USER' as const,
    }

    ;(auth as any).mockResolvedValue({ user: mockUser })
    ;(prisma.$queryRaw as any).mockResolvedValue([
      {
        id: 'msg-1',
        content: 'This is about password reset',
        roomId: 'room-1',
        roomTitle: 'Support',
        userId: 'user-1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        createdAt: new Date(),
        score: 0.95,
      },
    ])
    ;(prisma.message.findMany as any).mockResolvedValue([])

    const request = new Request('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'password reset' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.messages).toHaveLength(1)
    expect(data.data.messages[0].snippet).toContain('password reset')
  })

  it('should parse complex query syntax', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'USER' as const,
    }

    ;(auth as any).mockResolvedValue({ user: mockUser })
    ;(prisma.$queryRaw as any).mockResolvedValue([])
    ;(prisma.message.findMany as any).mockResolvedValue([])
    ;(prisma.room.findMany as any).mockResolvedValue([])

    const request = new Request('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'from:@alice tag:billing before:2024-01-01 issue' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    // Should parse filters correctly
  })

  it('should include parent context for threaded messages', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'USER' as const,
    }

    ;(auth as any).mockResolvedValue({ user: mockUser })
    ;(prisma.$queryRaw as any).mockResolvedValue([
      {
        id: 'msg-1',
        content: 'This is a reply',
        roomId: 'room-1',
        roomTitle: 'Support',
        userId: 'user-1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        parentMessageId: 'parent-1',
        createdAt: new Date(),
        score: 0.95,
      },
    ])
    ;(prisma.message.findMany as any).mockResolvedValue([
      {
        id: 'parent-1',
        content: 'This is the parent message',
        user: {
          id: 'user-2',
          name: 'Bob',
          email: 'bob@example.com',
        },
      },
    ])

    const request = new Request('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'reply' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.messages[0].parentContext).toBeDefined()
    expect(data.data.messages[0].parentContext.content).toBe('This is the parent message')
  })

  it('should search rooms when no roomId filter', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'USER' as const,
    }

    ;(auth as any).mockResolvedValue({ user: mockUser })
    ;(prisma.$queryRaw as any).mockResolvedValue([])
    ;(prisma.message.findMany as any).mockResolvedValue([])
    ;(prisma.room.findMany as any).mockResolvedValue([
      {
        id: 'room-1',
        name: '#support',
        title: 'Support',
        description: 'Support room',
        type: 'PUBLIC',
        _count: {
          members: 10,
          messages: 50,
        },
      },
    ])

    const request = new Request('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'support' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.rooms).toHaveLength(1)
  })

  it('should handle empty query', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'USER' as const,
    }

    ;(auth as any).mockResolvedValue({ user: mockUser })

    const request = new Request('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: '' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
  })

  it('should return snippets with highlighting markers', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'USER' as const,
    }

    ;(auth as any).mockResolvedValue({ user: mockUser })
    ;(prisma.$queryRaw as any).mockResolvedValue([
      {
        id: 'msg-1',
        content: 'This is about password reset functionality',
        roomId: 'room-1',
        roomTitle: 'Support',
        userId: 'user-1',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        createdAt: new Date(),
        score: 0.95,
      },
    ])
    ;(prisma.message.findMany as any).mockResolvedValue([])

    const request = new Request('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'password reset' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.messages[0].snippet).toBeDefined()
    // Snippet should contain the search terms
    expect(data.data.messages[0].snippet.toLowerCase()).toContain('password')
  })
})

