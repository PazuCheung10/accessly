import { describe, it, expect } from 'vitest'
import { Message } from '@/lib/chatStore'

describe('Threading - Message Structure', () => {
  it('should have parentMessageId field', () => {
    const message: Message = {
      id: 'msg-1',
      roomId: 'room-1',
      userId: 'user-1',
      content: 'Test message',
      parentMessageId: null,
      createdAt: new Date().toISOString(),
      user: { id: 'user-1', name: 'User', image: null },
    }

    expect(message.parentMessageId).toBeDefined()
    expect(message.parentMessageId).toBeNull()
  })

  it('should support replies structure', () => {
    const parentMessage: Message = {
      id: 'msg-1',
      roomId: 'room-1',
      userId: 'user-1',
      content: 'Parent message',
      parentMessageId: null,
      createdAt: new Date().toISOString(),
      user: { id: 'user-1', name: 'User 1', image: null },
      replies: [
        {
          id: 'msg-2',
          roomId: 'room-1',
          userId: 'user-2',
          content: 'Reply message',
          parentMessageId: 'msg-1',
          createdAt: new Date().toISOString(),
          user: { id: 'user-2', name: 'User 2', image: null },
        },
      ],
    }

    expect(parentMessage.replies).toBeDefined()
    expect(Array.isArray(parentMessage.replies)).toBe(true)
    expect(parentMessage.replies?.length).toBe(1)
    expect(parentMessage.replies?.[0].parentMessageId).toBe('msg-1')
  })
})

describe('Threading - Hierarchical Structure', () => {
  it('should organize messages into parent-child relationships', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        roomId: 'room-1',
        userId: 'user-1',
        content: 'Parent',
        parentMessageId: null,
        createdAt: new Date('2025-11-07T10:00:00Z').toISOString(),
        user: { id: 'user-1', name: 'User 1', image: null },
      },
      {
        id: 'msg-2',
        roomId: 'room-1',
        userId: 'user-2',
        content: 'Reply 1',
        parentMessageId: 'msg-1',
        createdAt: new Date('2025-11-07T10:05:00Z').toISOString(),
        user: { id: 'user-2', name: 'User 2', image: null },
      },
      {
        id: 'msg-3',
        roomId: 'room-1',
        userId: 'user-3',
        content: 'Reply 2',
        parentMessageId: 'msg-1',
        createdAt: new Date('2025-11-07T10:10:00Z').toISOString(),
        user: { id: 'user-3', name: 'User 3', image: null },
      },
    ]

    // Organize into hierarchical structure
    const rootMessages = messages.filter((m) => !m.parentMessageId)
    const repliesByParent = new Map<string, Message[]>()

    for (const msg of messages) {
      if (msg.parentMessageId) {
        const replies = repliesByParent.get(msg.parentMessageId) || []
        replies.push(msg)
        repliesByParent.set(msg.parentMessageId, replies)
      }
    }

    expect(rootMessages.length).toBe(1)
    expect(rootMessages[0].id).toBe('msg-1')
    expect(repliesByParent.get('msg-1')?.length).toBe(2)
    expect(repliesByParent.get('msg-1')?.[0].id).toBe('msg-2')
    expect(repliesByParent.get('msg-1')?.[1].id).toBe('msg-3')
  })
})

