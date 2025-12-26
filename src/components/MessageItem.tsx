'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface MessageItemProps {
  message: {
    id: string
    content: string
    createdAt: string
    editedAt?: string | null
    deletedAt?: string | null
    reactions?: Record<string, string[]> | null
    parentMessageId?: string | null
    user: {
      id: string
      name: string | null
      image: string | null
    } | null // Allow null for system messages
  }
  currentUserId: string
  roomId?: string
  onMessageUpdate?: (messageId: string, updates: Partial<MessageItemProps['message']>) => void
  onReply?: (messageId: string) => void
  onToggleThread?: (messageId: string) => void
  isReply?: boolean
  replyCount?: number
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export function MessageItem({ message, currentUserId, roomId, onMessageUpdate, onReply, onToggleThread, isReply = false, replyCount = 0 }: MessageItemProps) {
  const { data: session } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [localReactions, setLocalReactions] = useState<Record<string, string[]>>(
    (message.reactions as Record<string, string[]>) || {}
  )
  const isUpdatingReactionsRef = useRef(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  // Update local reactions when message prop changes (from socket updates)
  // But don't overwrite if we just updated it locally
  useEffect(() => {
    if (isUpdatingReactionsRef.current) {
      isUpdatingReactionsRef.current = false
      return
    }
    const reactions = message.reactions as Record<string, string[]> | null | undefined
    if (reactions && typeof reactions === 'object') {
      setLocalReactions(reactions)
    } else {
      setLocalReactions({})
    }
  }, [message.reactions, message.id])

  // Handle missing user gracefully - allow system messages
  // Must be after all hooks to comply with Rules of Hooks
  const displayName = message.user?.name || message.user?.id || "System"
  const userId = message.user?.id || null
  
  // If no user, treat as system message (not owned by current user)
  const isOwn = userId ? userId === currentUserId : false
  const isDeleted = !!message.deletedAt
  const createdAt = new Date(message.createdAt)
  const timeAgo = formatTimeAgo(createdAt)

  // Check if message can be edited (within 10 minutes)
  const canEdit = isOwn && !isDeleted && !isEditing
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  const withinEditWindow = createdAt >= tenMinutesAgo

  const handleEdit = async () => {
    if (!editContent.trim()) return

    try {
      const response = await fetch(`/api/chat/messages/${message.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: editContent }),
      })

      const data = await response.json()
      if (data.ok) {
        setIsEditing(false)
        onMessageUpdate?.(message.id, {
          content: data.data.content,
          editedAt: data.data.editedAt,
        })
      } else {
        alert(data.message || 'Failed to edit message')
      }
    } catch (err) {
      console.error('Error editing message:', err)
      alert('Failed to edit message')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this message?')) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/chat/messages/${message.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.ok) {
        onMessageUpdate?.(message.id, {
          content: '[Message deleted]',
          deletedAt: data.data.deletedAt,
        })
      } else {
        alert(data.message || 'Failed to delete message')
      }
    } catch (err) {
      console.error('Error deleting message:', err)
      alert('Failed to delete message')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleReaction = async (emoji: string) => {
    // Prevent reacting to own messages
    if (isOwn) return

    try {
      const response = await fetch(`/api/chat/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure session cookie is sent
        cache: 'no-store',
        body: JSON.stringify({ emoji }),
      })

      let payload: any = {}
      let parseError = null

      // Clone response before reading to avoid consuming the body
      const clonedResponse = response.clone()
      
      try {
        payload = await clonedResponse.json()
      } catch (e: any) {
        parseError = e
      }

      if (!response.ok || !payload?.ok) {
        // Fallback: peek at raw text if JSON failed
        const ctype = response.headers.get('content-type') || ''
        let text = ''
        try {
          text = await response.text()
        } catch {
          // Response body already consumed
        }
        console.error('Failed to update reaction:', {
          status: response.status,
          contentType: ctype,
          jsonOk: !parseError,
          json: payload,
          textSnippet: text.slice(0, 500),
        })
        return
      }

      const newReactions = (payload.data?.reactions as Record<string, string[]>) || {}
      isUpdatingReactionsRef.current = true
      setLocalReactions(newReactions)
      onMessageUpdate?.(message.id, {
        reactions: newReactions,
      })
    } catch (err) {
      console.error('Error toggling reaction:', err)
    }
  }

  const getUserReaction = (): string | null => {
    // Find which emoji the current user has reacted with
    for (const [emoji, userIds] of Object.entries(localReactions)) {
      if (userIds.includes(currentUserId)) {
        return emoji
      }
    }
    return null
  }

  const getReactionBadges = () => {
    // Sort reactions by count (descending)
    const sorted = Object.entries(localReactions)
      .map(([emoji, userIds]) => ({ emoji, count: userIds.length }))
      .sort((a, b) => b.count - a.count)

    // Show top 3, and total count if more
    const top3 = sorted.slice(0, 3)
    const remainingCount = sorted.slice(3).reduce((sum, r) => sum + r.count, 0)

    return { top3, remainingCount }
  }

  // Test function for debugging reactions
  const testReaction = async () => {
    const testEmoji = '👍'
    setTestResult('Testing...')
    
    const diagnosticInfo: any = {
      messageId: message.id,
      currentUserId,
      sessionUserId: session?.user?.id,
      sessionEmail: session?.user?.email,
      cookies: document.cookie,
      url: `/api/chat/messages/${message.id}/reactions`,
    }

    try {
      console.log('[TEST] Starting reaction test:', diagnosticInfo)
      
      const response = await fetch(`/api/chat/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ emoji: testEmoji }),
      })

      const contentType = response.headers.get('content-type') || ''
      let payload: any = {}
      let parseError = null

      // Clone response before reading to avoid consuming the body
      const clonedResponse = response.clone()
      
      try {
        payload = await clonedResponse.json()
      } catch (e: any) {
        parseError = e.message
      }

      let text = ''
      try {
        text = await response.text()
      } catch {
        // Response body already consumed
      }

      const result = {
        status: response.status,
        statusText: response.statusText,
        contentType,
        ok: response.ok,
        jsonParseError: parseError,
        payload,
        textSnippet: text.slice(0, 300),
        headers: Object.fromEntries(response.headers.entries()),
      }

      diagnosticInfo.response = result
      console.log('[TEST] Full diagnostic:', diagnosticInfo)
      console.log('[TEST] Response:', result)

      // Show result in alert
      const resultText = `
Status: ${result.status} ${result.statusText}
Content-Type: ${result.contentType}
OK: ${result.ok}
JSON Parse Error: ${result.jsonParseError || 'None'}
Payload: ${JSON.stringify(result.payload, null, 2)}
Text Preview: ${result.textSnippet.slice(0, 200)}
      `.trim()

      setTestResult(resultText)
      alert(`Reaction Test Result:\n\n${resultText}\n\nCheck console for full details.`)
    } catch (err: any) {
      const errorResult = {
        error: err.message,
        stack: err.stack,
      }
      console.error('[TEST] Error:', errorResult)
      setTestResult(`Error: ${err.message}`)
      alert(`Reaction Test Error:\n\n${err.message}\n\nCheck console for details.`)
    }
  }

  return (
    <div className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''} ${isReply ? 'ml-8' : ''}`}>
      <div className={`flex flex-col max-w-[70%] relative ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1">
          {!isOwn && (
            <span className="text-sm font-medium text-slate-300">
              {displayName}
            </span>
          )}
          <span className="text-xs text-slate-500">{timeAgo}</span>
          {message.editedAt && (
            <span className="text-xs text-slate-500 italic">(edited)</span>
          )}
        </div>
        {isEditing ? (
          <div className="w-full">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleEdit}
                className="px-3 py-1 text-sm bg-cyan-600 hover:bg-cyan-700 rounded"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditContent(message.content)
                }}
                className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`px-4 py-2 rounded-lg relative ${
                isDeleted
                  ? 'bg-slate-800/50 text-slate-500 italic'
                  : isOwn
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {isDeleted ? '[Message deleted]' : message.content}
              </p>
              {/* Edit/Delete/Reply/Reaction buttons - positioned on the side */}
              {(() => {
                const showReplyButton = !isDeleted && onReply && !message.parentMessageId
                const showEmojiButton = !isDeleted // Allow emoji reactions on own messages for symmetry
                // Adjust offset for replies to account for indentation (ml-8 + pl-4 = 3rem total)
                // Replies need less offset to maintain same visual gap
                // For own messages with flex-row-reverse, when replying to self, need to account for the indentation
                const offsetClass = isReply
                  ? (isOwn ? '-left-9' : '-right-9')
                  : (isOwn ? '-left-16' : '-right-16')
                
                return (
                  <div className={`absolute ${offsetClass} top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {/* Reaction button - only for non-own messages */}
                    {showEmojiButton && (
                      <div className="relative">
                        <button
                          onClick={() => setShowReactions(!showReactions)}
                          className="p-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
                          title="Add reaction"
                        >
                          😀
                        </button>
                        {showReactions && (
                          <div className="absolute bottom-full left-0 mb-2 flex gap-1 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                            {COMMON_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  handleReaction(emoji)
                                  setShowReactions(false)
                                }}
                                className="text-xl hover:scale-125 transition-transform"
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Only show reply button for root messages (not replies) - we only support 2 levels */}
                    {showReplyButton && (
                      <button
                        onClick={() => onReply(message.id)}
                        className="p-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
                        title="Reply to message"
                      >
                        💬
                      </button>
                    )}
                    {canEdit && withinEditWindow && (
                      <>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="p-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
                          title="Edit message"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="p-1 text-xs bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                          title="Delete message"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                )
              })()}
              {/* Test button - always visible on right side for debugging */}
              {/* {!isDeleted && (
                <div className={`absolute ${isOwn ? '-left-16' : '-right-16'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <button
                    onClick={testReaction}
                    className="p-1.5 text-xs bg-purple-600 hover:bg-purple-700 rounded font-semibold text-white"
                    title="Test Reaction API (Debug)"
                  >
                    🧪
                  </button>
                </div>
              )} */}
            </div>

            {/* Reply count indicator */}
            {!isDeleted && replyCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleThread?.(message.id)
                }}
                className="mt-1 text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
              >
                <span>💬</span>
                <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
              </button>
            )}

            {/* Reaction badges - show below message, always visible */}
            {!isDeleted && !isOwn && (() => {
              const { top3, remainingCount } = getReactionBadges()
              const userReaction = getUserReaction()
              
              if (top3.length === 0) return null

              return (
                <div className="mt-1 flex items-center gap-1 flex-wrap">
                  {top3.map(({ emoji, count }) => {
                    const isUserReaction = emoji === userReaction
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                          isUserReaction
                            ? 'bg-cyan-600 text-white border-2 border-cyan-400'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'
                        }`}
                        title={isUserReaction ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                      >
                        <span>{emoji}</span>
                        <span className="font-medium">{count}</span>
                      </button>
                    )
                  })}
                  {remainingCount > 0 && (
                    <span
                      className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300 border border-slate-600"
                      title={`${remainingCount} more reactions`}
                    >
                      {remainingCount > 24 ? '24+' : `+${remainingCount}`}
                    </span>
                  )}
                  {/* Cancel button if user has a reaction */}
                  {userReaction && (
                    <button
                      onClick={() => handleReaction(userReaction)}
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-full text-slate-400 hover:text-white transition-colors"
                      title="Remove your reaction"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours}h ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays}d ago`
  }

  return date.toLocaleDateString()
}