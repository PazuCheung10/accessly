'use client'

import { MessageItem } from './MessageItem'
import { Message } from '@/lib/chatStore'

interface ThreadViewProps {
  parentMessage: Message
  replies: Message[]
  currentUserId: string
  roomId: string
  onMessageUpdate?: (messageId: string, updates: Partial<Message>) => void
  onReply?: (messageId: string) => void
}

export function ThreadView({ parentMessage, replies, currentUserId, roomId, onMessageUpdate, onReply }: ThreadViewProps) {
  return (
    <div className="ml-8 mt-2 space-y-2 border-l-2 border-slate-700 pl-4">
      {/* Replies only - parent message is already shown above */}
      {replies.map((reply) => (
        <MessageItem
          key={reply.id}
          message={reply}
          currentUserId={currentUserId}
          roomId={roomId}
          onMessageUpdate={onMessageUpdate}
          onReply={onReply}
          isReply={true}
        />
      ))}
    </div>
  )
}

