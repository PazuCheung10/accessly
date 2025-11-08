import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DELETE } from '@/app/api/chat/messages/[messageId]/route'
import { PATCH as PATCH_STATUS } from '@/app/api/tickets/[ticketId]/status/route'
import { PATCH as PATCH_ROOM } from '@/app/api/chat/rooms/[roomId]/route'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/audit'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    roomMember: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/io', () => ({
  getIO: vi.fn(() => null),
}))

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn(),
}))

const { auth } = await import('@/lib/auth')

describe('Audit Logging Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Message Deletion', () => {
    it('should log audit entry when message is deleted', async () => {
      const mockMessage = {
        id: 'msg-1',
        roomId: 'room-1',
        userId: 'user-1',
        content: 'Test message content',
        deletedAt: null,
      }

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'user@test.com' },
        expires: new Date().toISOString(),
      } as any)

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
      } as any)

      vi.mocked(prisma.message.findUnique).mockResolvedValue(mockMessage as any)
      vi.mocked(prisma.message.update).mockResolvedValue({
        ...mockMessage,
        deletedAt: new Date(),
      } as any)

      const request = new Request('http://localhost/api/chat/messages/msg-1', {
        method: 'DELETE',
      })

      await DELETE(request, { params: Promise.resolve({ messageId: 'msg-1' }) })

      expect(logAction).toHaveBeenCalledWith(
        'message.delete',
        'user-1',
        'message',
        'msg-1',
        expect.objectContaining({
          roomId: 'room-1',
          originalContent: expect.any(String),
        })
      )
    })
  })

  describe('Ticket Status Change', () => {
    it('should log audit entry when ticket status changes', async () => {
      const mockTicket = {
        id: 'ticket-1',
        type: 'TICKET',
        status: 'OPEN',
        title: 'Test Ticket',
      }

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-1', email: 'admin@test.com' },
        expires: new Date().toISOString(),
      } as any)

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'admin-1',
        role: 'ADMIN',
      } as any)

      vi.mocked(prisma.room.findUnique).mockResolvedValue(mockTicket as any)
      vi.mocked(prisma.room.update).mockResolvedValue({
        id: 'ticket-1',
        status: 'RESOLVED',
      } as any)

      const request = new Request('http://localhost/api/tickets/ticket-1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' }),
      })

      await PATCH_STATUS(request, { params: { ticketId: 'ticket-1' } })

      expect(logAction).toHaveBeenCalledWith(
        'ticket.status.change',
        'admin-1',
        'room',
        'ticket-1',
        expect.objectContaining({
          oldStatus: 'OPEN',
          newStatus: 'RESOLVED',
          ticketTitle: 'Test Ticket',
        })
      )
    })
  })

  describe('Room Metadata Edit', () => {
    it('should log audit entry when room title is edited', async () => {
      const mockRoom = {
        id: 'room-1',
        title: 'Old Title',
        description: 'Old Description',
        tags: ['tag1'],
      }

      const mockMembership = {
        id: 'member-1',
        userId: 'user-1',
        roomId: 'room-1',
        role: 'OWNER',
      }

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'user@test.com' },
        expires: new Date().toISOString(),
      } as any)

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
      } as any)

      vi.mocked(prisma.room.findUnique)
        .mockResolvedValueOnce(mockRoom as any) // First call for current room
        .mockResolvedValueOnce(mockRoom as any) // Second call for update

      vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(mockMembership as any)
      vi.mocked(prisma.room.update).mockResolvedValue({
        ...mockRoom,
        title: 'New Title',
      } as any)

      const request = new Request('http://localhost/api/chat/rooms/room-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' }),
      })

      await PATCH_ROOM(request, { params: Promise.resolve({ roomId: 'room-1' }) })

      expect(logAction).toHaveBeenCalledWith(
        'room.edit',
        'user-1',
        'room',
        'room-1',
        expect.objectContaining({
          title: {
            old: 'Old Title',
            new: 'New Title',
          },
        })
      )
    })

    it('should log audit entry when room tags are edited', async () => {
      const mockRoom = {
        id: 'room-1',
        title: 'Test Room',
        description: 'Test Description',
        tags: ['old-tag'],
      }

      const mockMembership = {
        id: 'member-1',
        userId: 'user-1',
        roomId: 'room-1',
        role: 'OWNER',
      }

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'user@test.com' },
        expires: new Date().toISOString(),
      } as any)

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
      } as any)

      vi.mocked(prisma.room.findUnique)
        .mockResolvedValueOnce(mockRoom as any)
        .mockResolvedValueOnce(mockRoom as any)

      vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(mockMembership as any)
      vi.mocked(prisma.room.update).mockResolvedValue({
        ...mockRoom,
        tags: ['new-tag'],
      } as any)

      const request = new Request('http://localhost/api/chat/rooms/room-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: ['new-tag'] }),
      })

      await PATCH_ROOM(request, { params: Promise.resolve({ roomId: 'room-1' }) })

      expect(logAction).toHaveBeenCalledWith(
        'room.edit',
        'user-1',
        'room',
        'room-1',
        expect.objectContaining({
          tags: {
            old: ['old-tag'],
            new: ['new-tag'],
          },
        })
      )
    })

    it('should not log if no changes are made', async () => {
      const mockRoom = {
        id: 'room-1',
        title: 'Test Room',
        description: 'Test Description',
        tags: ['tag1'],
      }

      const mockMembership = {
        id: 'member-1',
        userId: 'user-1',
        roomId: 'room-1',
        role: 'OWNER',
      }

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'user@test.com' },
        expires: new Date().toISOString(),
      } as any)

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
      } as any)

      vi.mocked(prisma.room.findUnique)
        .mockResolvedValueOnce(mockRoom as any)
        .mockResolvedValueOnce(mockRoom as any)

      vi.mocked(prisma.roomMember.findUnique).mockResolvedValue(mockMembership as any)
      vi.mocked(prisma.room.update).mockResolvedValue(mockRoom as any)

      const request = new Request('http://localhost/api/chat/rooms/room-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Room' }), // Same as current
      })

      await PATCH_ROOM(request, { params: Promise.resolve({ roomId: 'room-1' }) })

      // Should not log if no actual changes
      expect(logAction).not.toHaveBeenCalled()
    })
  })
})

