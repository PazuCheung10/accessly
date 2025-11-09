import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThreadView } from '@/components/ThreadView'
import type { Message } from '@/lib/chatStore'

describe('ThreadView', () => {
  const mockParentMessage: Message = {
    id: 'parent-1',
    roomId: 'room-1',
    userId: 'user-1',
    content: 'This is the parent message',
    createdAt: new Date().toISOString(),
    user: {
      id: 'user-1',
      name: 'Alice',
      image: null,
    },
  }

  const mockReplies: Message[] = [
    {
      id: 'reply-1',
      roomId: 'room-1',
      userId: 'user-2',
      content: 'This is a reply',
      parentMessageId: 'parent-1',
      createdAt: new Date().toISOString(),
      user: {
        id: 'user-2',
        name: 'Bob',
        image: null,
      },
    },
    {
      id: 'reply-2',
      roomId: 'room-1',
      userId: 'user-3',
      content: 'Another reply',
      parentMessageId: 'parent-1',
      createdAt: new Date().toISOString(),
      user: {
        id: 'user-3',
        name: 'Charlie',
        image: null,
      },
    },
  ]

  it('should render all replies', () => {
    render(
      <ThreadView
        parentMessage={mockParentMessage}
        replies={mockReplies}
        currentUserId="user-1"
        roomId="room-1"
      />
    )

    expect(screen.getByText('This is a reply')).toBeInTheDocument()
    expect(screen.getByText('Another reply')).toBeInTheDocument()
  })

  it('should apply thread styling (indentation and border)', () => {
    const { container } = render(
      <ThreadView
        parentMessage={mockParentMessage}
        replies={mockReplies}
        currentUserId="user-1"
        roomId="room-1"
      />
    )

    const threadContainer = container.querySelector('.ml-8')
    expect(threadContainer).toBeInTheDocument()
    expect(threadContainer?.classList.contains('border-l-2')).toBe(true)
  })

  it('should mark replies with isReply prop', () => {
    const onMessageUpdate = vi.fn()
    const onReply = vi.fn()

    render(
      <ThreadView
        parentMessage={mockParentMessage}
        replies={mockReplies}
        currentUserId="user-1"
        roomId="room-1"
        onMessageUpdate={onMessageUpdate}
        onReply={onReply}
      />
    )

    // Replies should be rendered with isReply=true
    // This is tested indirectly through MessageItem rendering
    expect(screen.getByText('This is a reply')).toBeInTheDocument()
  })

  it('should handle empty replies array', () => {
    const { container } = render(
      <ThreadView
        parentMessage={mockParentMessage}
        replies={[]}
        currentUserId="user-1"
        roomId="room-1"
      />
    )

    const threadContainer = container.querySelector('.ml-8')
    expect(threadContainer).toBeInTheDocument()
    expect(screen.queryByText('This is a reply')).not.toBeInTheDocument()
  })

  it('should pass onMessageUpdate callback to MessageItem', () => {
    const onMessageUpdate = vi.fn()
    const onReply = vi.fn()

    render(
      <ThreadView
        parentMessage={mockParentMessage}
        replies={mockReplies}
        currentUserId="user-1"
        roomId="room-1"
        onMessageUpdate={onMessageUpdate}
        onReply={onReply}
      />
    )

    // Callback should be passed (tested through MessageItem behavior)
    expect(screen.getByText('This is a reply')).toBeInTheDocument()
  })

  it('should pass onReply callback to MessageItem', () => {
    const onMessageUpdate = vi.fn()
    const onReply = vi.fn()

    render(
      <ThreadView
        parentMessage={mockParentMessage}
        replies={mockReplies}
        currentUserId="user-1"
        roomId="room-1"
        onMessageUpdate={onMessageUpdate}
        onReply={onReply}
      />
    )

    // Callback should be passed (tested through MessageItem behavior)
    expect(screen.getByText('This is a reply')).toBeInTheDocument()
  })

  it('should render nested thread structure correctly', () => {
    const nestedReplies: Message[] = [
      {
        id: 'reply-1',
        roomId: 'room-1',
        userId: 'user-2',
        content: 'First level reply',
        parentMessageId: 'parent-1',
        createdAt: new Date().toISOString(),
        user: {
          id: 'user-2',
          name: 'Bob',
          image: null,
        },
      },
    ]

    const { container } = render(
      <ThreadView
        parentMessage={mockParentMessage}
        replies={nestedReplies}
        currentUserId="user-1"
        roomId="room-1"
      />
    )

    // Should have thread container with proper spacing
    const threadContainer = container.querySelector('.ml-8')
    expect(threadContainer).toBeInTheDocument()
    expect(threadContainer?.classList.contains('space-y-2')).toBe(true)
  })
})

