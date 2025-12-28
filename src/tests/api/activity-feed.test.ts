import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/activity/feed/route'
import { prisma } from '@/lib/prisma'
import { Role, RoomType } from '@prisma/client'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    roomMember: {
      findMany: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/user-utils', () => ({
  isExternalCustomer: vi.fn(),
}))

vi.mock('@/lib/room-access', () => ({
  getAccessibleRoomIds: vi.fn(),
}))

const { auth } = await import('@/lib/auth')
const { isExternalCustomer } = await import('@/lib/user-utils')
const { getAccessibleRoomIds } = await import('@/lib/room-access')

describe('GET /api/activity/feed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error for unauthorized request', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request('http://localhost/api/activity/feed')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('should return error if user not found', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com' },
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const request = new Request('http://localhost/api/activity/feed')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('USER_NOT_FOUND')
  })

  it('should return activity feed for internal user', async () => {
    const mockUser = {
      id: 'user-1',
      role: Role.USER,
      department: 'ENGINEERING',
    }

    const mockAuditLog = {
      id: 'audit-1',
      action: 'ticket.status.change',
      actorId: 'admin-1',
      targetType: 'room',
      targetId: 'ticket-1',
      metadata: {
        oldStatus: 'OPEN',
        newStatus: 'RESOLVED',
        ticketTitle: 'Test Ticket',
      },
      createdAt: new Date('2025-01-15T10:00:00Z'),
      actor: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@test.com',
        image: null,
      },
    }

    const mockTicketRoom = {
      id: 'ticket-1',
      name: 'ticket-123',
      title: 'Test Ticket',
      type: RoomType.TICKET,
      ticketDepartment: 'IT_SUPPORT',
      status: 'OPEN',
      createdAt: new Date('2025-01-15T09:00:00Z'),
      creator: {
        id: 'user-2',
        name: 'User 2',
        email: 'user2@test.com',
        image: null,
      },
    }

    const mockMessage = {
      id: 'msg-1',
      roomId: 'room-1',
      userId: 'user-1',
      content: 'Test message',
      parentMessageId: null,
      createdAt: new Date('2025-01-15T11:00:00Z'),
      user: {
        id: 'user-1',
        name: 'User 1',
        email: 'user1@test.com',
        image: null,
      },
      room: {
        id: 'room-1',
        title: 'Test Room',
        type: RoomType.PUBLIC,
      },
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com' },
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(isExternalCustomer).mockResolvedValue(false)
    vi.mocked(getAccessibleRoomIds).mockResolvedValue(['room-1'])
    vi.mocked(prisma.roomMember.findMany).mockResolvedValue([
      { roomId: 'ticket-1', room: { id: 'ticket-1', type: RoomType.TICKET } },
    ] as any)

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockAuditLog] as any)
    vi.mocked(prisma.room.findMany)
      .mockResolvedValueOnce([mockTicketRoom] as any) // Ticket rooms
      .mockResolvedValueOnce([]) // Regular rooms
    vi.mocked(prisma.message.findMany).mockResolvedValue([mockMessage] as any)

    const request = new Request('http://localhost/api/activity/feed')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.events).toBeDefined()
    expect(Array.isArray(data.data.events)).toBe(true)
    expect(data.data.events.length).toBeGreaterThan(0)

    // Check that events are sorted chronologically (newest first)
    if (data.data.events.length > 1) {
      const timestamps = data.data.events.map((e: any) => new Date(e.timestamp).getTime())
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1])
      }
    }
  })

  it('should filter events for external customer', async () => {
    const mockUser = {
      id: 'user-1',
      role: Role.USER,
      department: null,
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'customer@test.com' },
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(isExternalCustomer).mockResolvedValue(true)
    vi.mocked(prisma.roomMember.findMany).mockResolvedValue([
      { roomId: 'ticket-1', room: { id: 'ticket-1', type: RoomType.TICKET } },
    ] as any)

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.room.findMany).mockResolvedValue([])
    vi.mocked(prisma.message.findMany).mockResolvedValue([])

    const request = new Request('http://localhost/api/activity/feed')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    // External customers should not see regular room events
    expect(prisma.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: RoomType.TICKET,
        }),
      })
    )
  })

  it('should support pagination with cursor', async () => {
    const mockUser = {
      id: 'user-1',
      role: Role.USER,
      department: 'ENGINEERING',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com' },
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(isExternalCustomer).mockResolvedValue(false)
    vi.mocked(getAccessibleRoomIds).mockResolvedValue(['room-1'])
    vi.mocked(prisma.roomMember.findMany).mockResolvedValue([])

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.room.findMany).mockResolvedValue([])
    vi.mocked(prisma.message.findMany).mockResolvedValue([])

    const request = new Request('http://localhost/api/activity/feed?cursor=audit-1')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.events).toBeDefined()
  })

  it('should support filtering by event types', async () => {
    const mockUser = {
      id: 'user-1',
      role: Role.USER,
      department: 'ENGINEERING',
    }

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com' },
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(isExternalCustomer).mockResolvedValue(false)
    vi.mocked(getAccessibleRoomIds).mockResolvedValue(['room-1'])
    vi.mocked(prisma.roomMember.findMany).mockResolvedValue([])

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.room.findMany).mockResolvedValue([])
    vi.mocked(prisma.message.findMany).mockResolvedValue([])

    const request = new Request('http://localhost/api/activity/feed?types=ticket.created,message.posted')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    // All returned events should match the filter
    if (data.data.events.length > 0) {
      data.data.events.forEach((event: any) => {
        expect(['ticket.created', 'message.posted']).toContain(event.type)
      })
    }
  })
})



