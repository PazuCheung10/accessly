import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/support/tickets/route'
import { GET, POST as POST_TICKET } from '@/app/api/tickets/route'
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
      updateMany: vi.fn(),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
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

describe('POST /api/tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create ticket with non-admin assignee', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'admin-1',
        role: Role.ADMIN,
      } as any)
      .mockResolvedValueOnce({
        id: 'user-1',
        role: Role.USER,
      } as any)

    const mockTicket = {
      id: 'ticket-1',
      name: 'ticket-1234567890-abc',
      title: '[TICKET] Test Issue',
      description: 'Test description',
      type: 'TICKET',
      status: 'OPEN',
      isPrivate: true,
      creatorId: 'admin-1',
    }

    // Mock transaction
    const mockTransaction = vi.fn(async (callback: any) => {
      const tx = {
        room: {
          create: vi.fn().mockResolvedValue(mockTicket),
        },
        roomMember: {
          create: vi.fn().mockResolvedValue({}),
        },
      }
      return await callback(tx)
    })
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

    vi.mocked(prisma.message.create).mockResolvedValue({
      id: 'msg-1',
      roomId: 'ticket-1',
      userId: 'admin-1',
      content: 'Test description',
    } as any)

    const request = new Request('http://localhost/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Issue',
        description: 'Test description',
        assignToUserId: 'user-1',
      }),
    })

    const response = await POST_TICKET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.ticketId).toBeDefined()
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('should return INVALID_ASSIGNEE when assignee does not exist', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'admin-1',
        role: Role.ADMIN,
      } as any)
      .mockResolvedValueOnce(null) // Assignee not found

    const request = new Request('http://localhost/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Issue',
        description: 'Test description',
        assignToUserId: 'non-existent-user',
      }),
    })

    const response = await POST_TICKET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('INVALID_ASSIGNEE')
    expect(data.message).toBe('Assignee not found')
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

  it('should assign ticket to a non-admin user', async () => {
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
        id: 'user-1',
        role: Role.USER,
        name: 'Regular User',
        email: 'user@test.com',
      } as any)

    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'ticket-1',
      type: 'TICKET',
      title: 'Test Ticket',
    } as any)

    const currentOwner = {
      id: 'member-1',
      userId: 'admin-1',
      roomId: 'ticket-1',
      role: 'OWNER',
    }

    vi.mocked(prisma.roomMember.findFirst).mockResolvedValue(currentOwner as any)
    vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(null)

    // Mock transaction
    const mockTransaction = vi.fn(async (callback: any) => {
      const tx = {
        roomMember: {
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({}),
        },
      }
      return await callback(tx)
    })
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

    vi.mock('@/lib/audit', () => ({
      logAction: vi.fn().mockResolvedValue(undefined),
    }))

    const request = new Request('http://localhost/api/tickets/ticket-1/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignToUserId: 'user-1' }),
    })

    const response = await POST_ASSIGN(request, { params: Promise.resolve({ ticketId: 'ticket-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.assignedTo).toBe('user-1')
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('should reject assignment from non-admin caller', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: Role.USER,
    } as any)

    const request = new Request('http://localhost/api/tickets/ticket-1/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignToUserId: 'user-2' }),
    })

    const response = await POST_ASSIGN(request, { params: Promise.resolve({ ticketId: 'ticket-1' }) })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('FORBIDDEN')
  })

  it('should return INVALID_ASSIGNEE for non-existent user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'admin-1',
        role: Role.ADMIN,
      } as any)
      .mockResolvedValueOnce(null) // Assignee not found

    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'ticket-1',
      type: 'TICKET',
      title: 'Test Ticket',
    } as any)

    const request = new Request('http://localhost/api/tickets/ticket-1/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignToUserId: 'non-existent-user' }),
    })

    const response = await POST_ASSIGN(request, { params: Promise.resolve({ ticketId: 'ticket-1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('INVALID_ASSIGNEE')
    expect(data.message).toBe('Assignee not found')
  })

  it('should assign ticket to another admin (existing test, updated)', async () => {
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
        name: 'Admin 2',
        email: 'admin2@test.com',
      } as any)

    vi.mocked(prisma.room.findUnique).mockResolvedValue({
      id: 'ticket-1',
      type: 'TICKET',
      title: 'Test Ticket',
    } as any)

    const currentOwner = {
      id: 'member-1',
      userId: 'admin-1',
      roomId: 'ticket-1',
      role: 'OWNER',
    }

    vi.mocked(prisma.roomMember.findFirst).mockResolvedValue(currentOwner as any)
    vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(null)

    // Mock transaction
    const mockTransaction = vi.fn(async (callback: any) => {
      const tx = {
        roomMember: {
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({}),
        },
      }
      return await callback(tx)
    })
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction)

    vi.mock('@/lib/audit', () => ({
      logAction: vi.fn().mockResolvedValue(undefined),
    }))

    const request = new Request('http://localhost/api/tickets/ticket-1/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignToUserId: 'admin-2' }),
    })

    const response = await POST_ASSIGN(request, { params: Promise.resolve({ ticketId: 'ticket-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.assignedTo).toBe('admin-2')
  })
})

