import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/support/tickets/route'
import { GET } from '@/app/api/tickets/route'
import { PATCH } from '@/app/api/tickets/[ticketId]/status/route'
import { POST as POST_ASSIGN } from '@/app/api/tickets/[ticketId]/assign/route'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    roomMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const { auth } = await import('@/lib/auth')

describe('POST /api/support/tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create ticket without authentication', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'customer@test.com',
      name: 'Customer',
      role: Role.USER,
    }

    const mockAdmin = {
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin',
      role: Role.ADMIN,
    }

    const mockTicket = {
      id: 'ticket-1',
      name: 'ticket-1234567890-abc',
      title: 'Test Issue',
      description: 'Support ticket from Customer (customer@test.com)',
      type: 'TICKET',
      status: 'OPEN',
      isPrivate: true,
      creatorId: 'user-1',
    }

    const mockMessage = {
      id: 'msg-1',
      roomId: 'ticket-1',
      userId: 'user-1',
      content: 'I need help with something',
      parentMessageId: null,
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
      reactions: null,
      user: { id: 'user-1', name: 'Customer', image: null },
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null) // User doesn't exist
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockAdmin as any)
    vi.mocked(prisma.room.create).mockResolvedValue(mockTicket as any)
    vi.mocked(prisma.roomMember.create).mockResolvedValue({} as any)
    vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as any)

    const request = new Request('http://localhost/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Customer',
        email: 'customer@test.com',
        subject: 'Test Issue',
        message: 'I need help with something',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.ticketId).toBeDefined()
    expect(prisma.room.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'TICKET',
          status: 'OPEN',
        }),
      })
    )
    expect(prisma.message.create).toHaveBeenCalled()
  })

  it('should return validation error for invalid input', async () => {
    const request = new Request('http://localhost/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'invalid-email',
        subject: '',
        message: '',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /api/tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error for unauthorized request', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request('http://localhost/api/tickets')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('should return error for non-admin user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: Role.USER,
    } as any)

    const request = new Request('http://localhost/api/tickets')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('FORBIDDEN')
  })

  it('should return tickets for admin user', async () => {
    const mockTickets = [
      {
        id: 'ticket-1',
        name: 'ticket-123',
        title: 'Test Ticket',
        description: 'Test description',
        type: 'TICKET',
        status: 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { id: 'user-1', name: 'User', email: 'user@test.com' },
        members: [
          {
            role: 'OWNER',
            user: { id: 'admin-1', name: 'Admin', email: 'admin@test.com' },
          },
        ],
        messages: [
          {
            id: 'msg-1',
            content: 'Initial message',
            createdAt: new Date(),
            user: { id: 'user-1', name: 'User', email: 'user@test.com' },
          },
        ],
        _count: { messages: 1 },
      },
    ]

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
    } as any)

    vi.mocked(prisma.room.findMany).mockResolvedValue(mockTickets as any)

    const request = new Request('http://localhost/api/tickets')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.tickets).toBeDefined()
    expect(Array.isArray(data.data.tickets)).toBe(true)
  })
})

describe('PATCH /api/tickets/[ticketId]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update ticket status', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
    } as any)

    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'ticket-1',
      type: 'TICKET',
    } as any)

    vi.mocked(prisma.room.update).mockResolvedValue({
      id: 'ticket-1',
      status: 'RESOLVED',
    } as any)

    const request = new Request('http://localhost/api/tickets/ticket-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' }),
    })

    const response = await PATCH(request, { params: { ticketId: 'ticket-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.status).toBe('RESOLVED')
  })
})

describe('POST /api/tickets/[ticketId]/assign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should assign ticket to another admin', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin1@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'admin-1',
        role: Role.ADMIN,
      } as any)
      .mockResolvedValueOnce({
        id: 'admin-2',
        role: Role.ADMIN,
      } as any)

    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'ticket-1',
      type: 'TICKET',
    } as any)

    vi.mocked(prisma.roomMember.findFirst).mockResolvedValue({
      id: 'member-1',
      userId: 'admin-1',
      roomId: 'ticket-1',
      role: 'OWNER',
    } as any)

    vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.roomMember.update).mockResolvedValue({} as any)
    vi.mocked(prisma.roomMember.create).mockResolvedValue({} as any)

    const request = new Request('http://localhost/api/tickets/ticket-1/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignToUserId: 'admin-2' }),
    })

    const response = await POST_ASSIGN(request, { params: { ticketId: 'ticket-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.assignedTo).toBe('admin-2')
  })
})

