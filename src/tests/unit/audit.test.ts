import { describe, it, expect, beforeEach, vi } from 'vitest'
import { logAction } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}))

describe('logAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create audit log entry', async () => {
    const mockCreate = vi.mocked(prisma.auditLog.create)
    mockCreate.mockResolvedValue({
      id: 'audit-1',
      action: 'message.delete',
      actorId: 'user-1',
      targetType: 'message',
      targetId: 'msg-1',
      metadata: { roomId: 'room-1' },
      createdAt: new Date(),
    } as any)

    await logAction('message.delete', 'user-1', 'message', 'msg-1', {
      roomId: 'room-1',
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        action: 'message.delete',
        actorId: 'user-1',
        targetType: 'message',
        targetId: 'msg-1',
        metadata: { roomId: 'room-1' },
      },
    })
  })

  it('should handle null targetType and targetId', async () => {
    const mockCreate = vi.mocked(prisma.auditLog.create)
    mockCreate.mockResolvedValue({
      id: 'audit-2',
      action: 'user.ban',
      actorId: 'admin-1',
      targetType: null,
      targetId: null,
      metadata: {},
      createdAt: new Date(),
    } as any)

    await logAction('user.ban', 'admin-1', null, null)

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        action: 'user.ban',
        actorId: 'admin-1',
        targetType: null,
        targetId: null,
        metadata: {},
      },
    })
  })

  it('should handle missing metadata', async () => {
    const mockCreate = vi.mocked(prisma.auditLog.create)
    mockCreate.mockResolvedValue({
      id: 'audit-3',
      action: 'room.delete',
      actorId: 'admin-1',
      targetType: 'room',
      targetId: 'room-1',
      metadata: {},
      createdAt: new Date(),
    } as any)

    await logAction('room.delete', 'admin-1', 'room', 'room-1')

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        action: 'room.delete',
        actorId: 'admin-1',
        targetType: 'room',
        targetId: 'room-1',
        metadata: {},
      },
    })
  })

  it('should not throw error if audit log creation fails', async () => {
    const mockCreate = vi.mocked(prisma.auditLog.create)
    mockCreate.mockRejectedValue(new Error('Database error'))

    // Should not throw
    await expect(
      logAction('message.delete', 'user-1', 'message', 'msg-1')
    ).resolves.not.toThrow()
  })

  it('should log different action types', async () => {
    const mockCreate = vi.mocked(prisma.auditLog.create)
    mockCreate.mockResolvedValue({} as any)

    const actions = [
      'message.delete',
      'member.remove',
      'ticket.status.change',
      'room.edit',
      'room.delete',
      'ownership.transfer',
      'user.ban',
      'user.unban',
    ]

    for (const action of actions) {
      await logAction(action as any, 'user-1', 'room', 'room-1')
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action,
          }),
        })
      )
    }
  })
})

