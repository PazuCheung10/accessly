import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/admin/audit/route'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const { auth } = await import('@/lib/auth')

describe('GET /api/admin/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error for unauthorized request', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request('http://localhost/api/admin/audit')
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

    const request = new Request('http://localhost/api/admin/audit')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.ok).toBe(false)
    expect(data.code).toBe('FORBIDDEN')
  })

  it('should return audit logs for admin user', async () => {
    const mockLogs = [
      {
        id: 'audit-1',
        action: 'message.delete',
        actorId: 'user-1',
        targetType: 'message',
        targetId: 'msg-1',
        metadata: { roomId: 'room-1' },
        createdAt: new Date('2025-11-08T10:00:00Z'),
        actor: {
          id: 'user-1',
          name: 'User 1',
          email: 'user1@test.com',
          image: null,
        },
      },
      {
        id: 'audit-2',
        action: 'ticket.status.change',
        actorId: 'admin-1',
        targetType: 'room',
        targetId: 'ticket-1',
        metadata: { oldStatus: 'OPEN', newStatus: 'RESOLVED' },
        createdAt: new Date('2025-11-08T10:05:00Z'),
        actor: {
          id: 'admin-1',
          name: 'Admin',
          email: 'admin@test.com',
          image: null,
        },
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

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockLogs as any)

    const request = new Request('http://localhost/api/admin/audit')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.logs).toBeDefined()
    expect(Array.isArray(data.data.logs)).toBe(true)
    expect(data.data.logs.length).toBe(2)
    expect(data.data.logs[0].action).toBe('message.delete')
    expect(data.data.logs[1].action).toBe('ticket.status.change')
  })

  it('should filter by action', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
    } as any)

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as any)

    const request = new Request('http://localhost/api/admin/audit?action=message.delete')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: 'message.delete',
        }),
      })
    )
  })

  it('should filter by actorId', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
    } as any)

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as any)

    const request = new Request('http://localhost/api/admin/audit?actorId=user-1')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorId: 'user-1',
        }),
      })
    )
  })

  it('should filter by targetType and targetId', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
    } as any)

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as any)

    const request = new Request('http://localhost/api/admin/audit?targetType=room&targetId=room-1')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetType: 'room',
          targetId: 'room-1',
        }),
      })
    )
  })

  it('should support pagination with cursor', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
    } as any)

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as any)

    const request = new Request('http://localhost/api/admin/audit?cursor=audit-10')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { lt: 'audit-10' },
        }),
      })
    )
  })

  it('should limit results and return cursor', async () => {
    const mockLogs = Array.from({ length: 101 }, (_, i) => ({
      id: `audit-${i}`,
      action: 'message.delete',
      actorId: 'user-1',
      targetType: 'message',
      targetId: `msg-${i}`,
      metadata: {},
      createdAt: new Date(),
      actor: {
        id: 'user-1',
        name: 'User',
        email: 'user@test.com',
        image: null,
      },
    }))

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
      expires: new Date().toISOString(),
    } as any)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
    } as any)

    vi.mocked(prisma.auditLog.findMany).mockResolvedValue(mockLogs as any)

    const request = new Request('http://localhost/api/admin/audit?limit=100')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.logs.length).toBe(100)
    expect(data.data.hasMore).toBe(true)
    expect(data.data.cursor).toBeDefined()
  })
})

