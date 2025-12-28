import { describe, it, expect } from 'vitest'
import {
  normalizeAuditLog,
  normalizeRoom,
  normalizeMessage,
} from '@/lib/activity/normalize'
import { ActivityEvent } from '@/lib/activity/types'

describe('Activity Normalization', () => {
  describe('normalizeAuditLog', () => {
    it('should normalize ticket status change audit log', () => {
      const auditLog = {
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
          name: 'Admin User',
          email: 'admin@test.com',
          image: null,
        },
      } as any

      const result = normalizeAuditLog(auditLog)

      expect(result).not.toBeNull()
      expect(result?.id).toBe('audit-audit-1')
      expect(result?.type).toBe('ticket.status.changed')
      expect(result?.actor.id).toBe('admin-1')
      expect(result?.target.id).toBe('ticket-1')
      expect(result?.target.title).toBe('Test Ticket')
      expect(result?.metadata.oldStatus).toBe('OPEN')
      expect(result?.metadata.newStatus).toBe('RESOLVED')
      expect(result?.source).toBe('audit')
    })

    it('should normalize ticket assign audit log', () => {
      const auditLog = {
        id: 'audit-2',
        action: 'ticket.assign',
        actorId: 'admin-1',
        targetType: 'room',
        targetId: 'ticket-1',
        metadata: {
          assignedToUserId: 'admin-2',
          assignedToName: 'Admin 2',
          ticketTitle: 'Test Ticket',
        },
        createdAt: new Date('2025-01-15T11:00:00Z'),
        actor: {
          id: 'admin-1',
          name: 'Admin User',
          email: 'admin@test.com',
          image: null,
        },
      } as any

      const result = normalizeAuditLog(auditLog)

      expect(result).not.toBeNull()
      expect(result?.type).toBe('ticket.assigned')
      expect(result?.metadata.assignedToUserId).toBe('admin-2')
      expect(result?.metadata.assignedToName).toBe('Admin 2')
    })

    it('should return null for unmapped audit actions', () => {
      const auditLog = {
        id: 'audit-3',
        action: 'user.ban',
        actorId: 'admin-1',
        targetType: 'user',
        targetId: 'user-1',
        metadata: {},
        createdAt: new Date(),
        actor: {
          id: 'admin-1',
          name: 'Admin',
          email: 'admin@test.com',
          image: null,
        },
      } as any

      const result = normalizeAuditLog(auditLog)

      expect(result).toBeNull()
    })
  })

  describe('normalizeRoom', () => {
    it('should normalize ticket room as ticket.created', () => {
      const room = {
        id: 'ticket-1',
        name: 'ticket-123',
        title: 'Test Ticket',
        type: 'TICKET',
        ticketDepartment: 'IT_SUPPORT',
        status: 'OPEN',
        isPrivate: true,
        createdAt: new Date('2025-01-15T09:00:00Z'),
        creator: {
          id: 'user-1',
          name: 'User 1',
          email: 'user1@test.com',
          image: null,
        },
      } as any

      const result = normalizeRoom(room, 'ticket.created')

      expect(result.id).toBe('room-ticket-1')
      expect(result.type).toBe('ticket.created')
      expect(result.actor.id).toBe('user-1')
      expect(result.target.id).toBe('ticket-1')
      expect(result.target.title).toBe('Test Ticket')
      expect(result.metadata.ticketDepartment).toBe('IT_SUPPORT')
      expect(result.metadata.status).toBe('OPEN')
      expect(result.source).toBe('room')
    })

    it('should normalize regular room as room.created', () => {
      const room = {
        id: 'room-1',
        name: '#general',
        title: 'General Discussion',
        type: 'PUBLIC',
        isPrivate: false,
        createdAt: new Date('2025-01-15T08:00:00Z'),
        creator: {
          id: 'user-1',
          name: 'User 1',
          email: 'user1@test.com',
          image: null,
        },
      } as any

      const result = normalizeRoom(room, 'room.created')

      expect(result.id).toBe('room-room-1')
      expect(result.type).toBe('room.created')
      expect(result.metadata.roomType).toBe('PUBLIC')
      expect(result.metadata.isPrivate).toBe(false)
    })

    it('should handle room with null creator', () => {
      const room = {
        id: 'room-2',
        name: '#test',
        title: 'Test Room',
        type: 'PUBLIC',
        isPrivate: false,
        createdAt: new Date('2025-01-15T08:00:00Z'),
        creator: null,
      } as any

      const result = normalizeRoom(room, 'room.created')

      expect(result.actor.id).toBe('')
      expect(result.actor.name).toBeNull()
    })
  })

  describe('normalizeMessage', () => {
    it('should normalize message as message.posted', () => {
      const message = {
        id: 'msg-1',
        roomId: 'room-1',
        userId: 'user-1',
        content: 'This is a test message',
        parentMessageId: null,
        createdAt: new Date('2025-01-15T12:00:00Z'),
        user: {
          id: 'user-1',
          name: 'User 1',
          email: 'user1@test.com',
          image: null,
        },
        room: {
          id: 'room-1',
          title: 'Test Room',
          type: 'PUBLIC',
        },
      } as any

      const result = normalizeMessage(message)

      expect(result.id).toBe('message-msg-1')
      expect(result.type).toBe('message.posted')
      expect(result.actor.id).toBe('user-1')
      expect(result.target.id).toBe('room-1')
      expect(result.target.title).toBe('Test Room')
      expect(result.metadata.content).toBe('This is a test message')
      expect(result.metadata.isThreadReply).toBe(false)
      expect(result.source).toBe('message')
    })

    it('should truncate long message content', () => {
      const longContent = 'a'.repeat(150)
      const message = {
        id: 'msg-2',
        roomId: 'room-1',
        userId: 'user-1',
        content: longContent,
        parentMessageId: null,
        createdAt: new Date('2025-01-15T12:00:00Z'),
        user: {
          id: 'user-1',
          name: 'User 1',
          email: 'user1@test.com',
          image: null,
        },
        room: {
          id: 'room-1',
          title: 'Test Room',
          type: 'PUBLIC',
        },
      } as any

      const result = normalizeMessage(message)

      expect(result.metadata.content.length).toBe(100)
    })

    it('should mark thread replies correctly', () => {
      const message = {
        id: 'msg-3',
        roomId: 'room-1',
        userId: 'user-1',
        content: 'Reply message',
        parentMessageId: 'msg-1',
        createdAt: new Date('2025-01-15T12:05:00Z'),
        user: {
          id: 'user-1',
          name: 'User 1',
          email: 'user1@test.com',
          image: null,
        },
        room: {
          id: 'room-1',
          title: 'Test Room',
          type: 'PUBLIC',
        },
      } as any

      const result = normalizeMessage(message)

      expect(result.metadata.isThreadReply).toBe(true)
    })
  })
})



