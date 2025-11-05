'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { initSocket } from '@/lib/socket'
import { useChatStore, Message as Msg } from '@/lib/chatStore'
import { isNearBottom, scrollToBottom, preserveScrollOnPrepend } from '@/lib/scroll'
import { MessageItem } from './MessageItem'
import { PresenceBar } from './PresenceBar'

// Store unsent messages per room (outside component to persist across re-renders)
const unsentMessages: Record<string, string> = {}

interface ChatRoomProps {
  roomId: string
  roomName: string
  isSwitchingRoom?: boolean
  onMessagesLoaded?: () => void
}

export function ChatRoom({ roomId, roomName, isSwitchingRoom = false, onMessagesLoaded }: ChatRoomProps) {
  const { data: session } = useSession()
  
  // Subscribe to the room slice directly (not via getter method)
  const room = useChatStore((s) => s.rooms[roomId])
  const setRoom = useChatStore((s) => s.setRoom)
  const upsertMessages = useChatStore((s) => s.upsertMessages)

  const messages: Msg[] = room?.messages ?? []

  const [input, setInput] = useState(() => unsentMessages[roomId] || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitialisedRef = useRef(false) // for this room lifecycle
  const currentRoomIdRef = useRef<string>(roomId)
  const prevRoomIdRef = useRef(roomId)
  const inputRef = useRef<string>(input)
  const [isRestoringScroll, setIsRestoringScroll] = useState(false)

  // Keep inputRef in sync with input state
  useEffect(() => {
    inputRef.current = input
  }, [input])

  // Save input to unsentMessages whenever it changes (only for the current room)
  useEffect(() => {
    if (currentRoomIdRef.current === roomId) {
      unsentMessages[roomId] = input
      inputRef.current = input
    }
  }, [input, roomId])

  // Handle room switching: save previous room's input, restore new room's input
  useEffect(() => {
    const previousRoomId = currentRoomIdRef.current

    if (previousRoomId && previousRoomId !== roomId) {
      unsentMessages[previousRoomId] = inputRef.current
    }

    const savedInput = unsentMessages[roomId] || ''
    setInput(savedInput)
    inputRef.current = savedInput
    currentRoomIdRef.current = roomId
  }, [roomId])

  // 2) Save the previous room's scrollTop when roomId changes (only if initialised)
  useEffect(() => {
    const el = messagesContainerRef.current
    if (
      el &&
      prevRoomIdRef.current &&
      prevRoomIdRef.current !== roomId &&
      hasInitialisedRef.current // <- don't save if not initialised
    ) {
      setRoom(prevRoomIdRef.current, { scrollTop: el.scrollTop })
    }
    prevRoomIdRef.current = roomId
  }, [roomId, setRoom])

  // 4.1 Save scrollTop when unmounting or switching away (only if initialised)
  useEffect(() => {
    return () => {
      const el = messagesContainerRef.current
      if (el && hasInitialisedRef.current) {
        setRoom(roomId, { scrollTop: el.scrollTop })
      }
    }
  }, [roomId, setRoom])

  // 3) Restore scroll synchronously (before paint) for cached messages
  useLayoutEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return

    hasInitialisedRef.current = false

    if (room?.messages?.length) {
      // 1) ensure messages render instead of loader
      setIsLoadingMessages(false)

      // 2) For cached messages with saved scroll position, hide container until scroll is set
      if (room.scrollTop != null && room.scrollTop > 0) {
        // Hide container to prevent flash
        setIsRestoringScroll(true)
        
        // Set scroll synchronously in useLayoutEffect (before paint)
        el.scrollTop = room.scrollTop
        
        // Use double rAF to ensure layout is complete, then show container
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              // Ensure scroll position is correct
              if (messagesContainerRef.current.scrollTop !== room.scrollTop) {
                messagesContainerRef.current.scrollTop = room.scrollTop!
              }
              // Now show the container (no flash!)
              setIsRestoringScroll(false)
              hasInitialisedRef.current = true
            }
          })
        })
      } else {
        // First visit to this room → wait for DOM to paint, then jump to bottom
        setIsRestoringScroll(false) // Show immediately for first visit
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!messagesContainerRef.current) return
            const box = messagesContainerRef.current
            box.scrollTop = box.scrollHeight
            hasInitialisedRef.current = true
          })
        })
      }
    } else {
      setIsLoadingMessages(true)
      setIsRestoringScroll(false)
    }
    // Watch exactly the pieces that matter for restoration
  }, [roomId, room?.messages?.length, room?.scrollTop])

  // 4.3 Initial fetch if needed
  useEffect(() => {
    if (!session?.user?.id) return

    if (room?.messages?.length) {
      // optional: fetch incrementals after initial paint
      void fetchNewerAfter()
      onMessagesLoaded?.()
      return
    }

    void fetchInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, session?.user?.id])

  // 4.4 Socket for live messages (only affect current room)
  useEffect(() => {
    if (!session?.user?.id) return

    const socket = initSocket(session.user.id)

    const handleMessageNew = (m: Msg) => {
      if (m.roomId !== roomId || !m.user?.id) return

      const el = messagesContainerRef.current
      const atBottom = el ? isNearBottom(el, 100) : true

      upsertMessages(roomId, [m])

      // Only snap to bottom if at/near bottom already
      if (el && atBottom) {
        scrollToBottom(el)
        setRoom(roomId, { scrollTop: el.scrollTop })
      }
    }

    socket.on('message:new', handleMessageNew)
    socket.emit('room:join', { roomId, userId: session.user.id })

    return () => {
      socket.off('message:new', handleMessageNew)
      socket.emit('room:leave', { roomId, userId: session.user.id })
    }
  }, [roomId, session?.user?.id, upsertMessages, setRoom])

  // 4.5 Track user scroll → remember per-room
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasInitialisedRef.current) return
    useChatStore.getState().setRoom(roomId, { scrollTop: e.currentTarget.scrollTop })
  }

  // 4.6 Pagination: load older (on demand or when top sentinel enters view)
  const fetchOlder = async () => {
    const el = messagesContainerRef.current
    if (!el) return

    const currentCursor = useChatStore.getState().rooms[roomId]?.cursor ?? room?.cursor ?? null
    if (!currentCursor) return // no older

    try {
      setIsLoadingMessages(true)

      const res = await fetch(`/api/chat/messages?roomId=${roomId}&limit=50&cursor=${currentCursor}`)
      const json = await res.json()
      const older: Msg[] = (json.data?.messages ?? json.messages ?? []).filter((m: Msg) => m.user?.id)

      if (older.length === 0) return

      // Prepend older with anchored scroll
      preserveScrollOnPrepend(el, () => {
        upsertMessages(roomId, older, { asPrepend: true })
      })

      // Update cursor to the new oldest
      const newOldest = older[0]?.id ?? currentCursor
      setRoom(roomId, { cursor: newOldest })
    } catch (err) {
      console.error('Error fetching older messages:', err)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // 4.7 Incremental fetch for *newer* messages after what we have (optional on enter)
  const fetchNewerAfter = async () => {
    const lastId =
      useChatStore.getState().rooms[roomId]?.lastMessageId ??
      room?.lastMessageId ??
      null
    if (!lastId) return

    try {
      const res = await fetch(`/api/chat/messages?roomId=${roomId}&limit=50&after=${lastId}`)
      const json = await res.json()
      const newer: Msg[] = (json.data?.messages ?? json.messages ?? []).filter((m: Msg) => m.user?.id)

      if (!newer.length) return

      upsertMessages(roomId, newer)

      // If user was at bottom, keep them at bottom
      const el = messagesContainerRef.current
      if (el && isNearBottom(el, 100)) {
        scrollToBottom(el)
        setRoom(roomId, { scrollTop: el.scrollTop })
      }
    } catch (err) {
      console.error('Error fetching newer messages:', err)
    }
  }

  // 4.8 First-time fetch (latest page) → render → jump to bottom (no animation)
  const fetchInitial = async () => {
    try {
      setIsLoadingMessages(true)
      const res = await fetch(`/api/chat/messages?roomId=${roomId}&limit=50`)
      const json = await res.json()
      const msgs: Msg[] = (json.data?.messages ?? json.messages ?? []).filter((m: Msg) => m.user?.id)

      // Store messages; also set cursor & lastMessageId
      const oldest = msgs[0]?.id ?? null
      const newest = msgs[msgs.length - 1]?.id ?? null
      setRoom(roomId, { cursor: oldest, lastMessageId: newest })
      upsertMessages(roomId, msgs)
    } catch (err) {
      console.error('Error fetching initial messages:', err)
      setError('Failed to load messages')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setIsLoadingMessages(false)

      // Now that they've rendered, snap to bottom instantly
      const el = messagesContainerRef.current
      if (el) {
        scrollToBottom(el) // immediate (no smooth)
        setRoom(roomId, { scrollTop: el.scrollTop })
      }

      hasInitialisedRef.current = true
      onMessagesLoaded?.()

      // Optional: immediately poll for any very-new messages
      void fetchNewerAfter()
    }
  }

  // Send message function
  const sendMessage = async () => {
    if (!input.trim() || !session?.user?.id) return

    const content = input.trim()
    setInput('')
    unsentMessages[roomId] = ''
    setIsLoading(true)
    setError(null)

    // Optimistic update
    const optimisticMessage: Msg = {
      id: `temp-${Date.now()}`,
      roomId,
      userId: session.user.id,
      content,
      createdAt: new Date().toISOString(),
      user: {
        id: session.user.id,
        name: session.user.name,
        image: session.user.image,
      },
    }

    upsertMessages(roomId, [optimisticMessage])

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          content,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        const errorMessage = data.message || data.error || 'Failed to send message'
        throw new Error(errorMessage)
      }

      const savedMessage = data.data

      if (!savedMessage || typeof savedMessage !== 'object') {
        console.error('Invalid saved message format:', savedMessage)
        // Remove optimistic message
        const currentMessages = room?.messages ?? []
        const filtered = currentMessages.filter((m: Msg) => m.id !== optimisticMessage.id)
        setRoom(roomId, { messages: filtered })
        throw new Error('Invalid message format from server')
      }

      if (!savedMessage.user || !savedMessage.user.id) {
        console.error('Saved message missing user.id:', savedMessage)
        // Remove optimistic message
        const currentMessages = room?.messages ?? []
        const filtered = currentMessages.filter((m: Msg) => m.id !== optimisticMessage.id)
        setRoom(roomId, { messages: filtered })
        throw new Error('Invalid message format from server')
      }

      // Remove optimistic and add real message (upsertMessages handles deduplication)
      const currentMessages = room?.messages ?? []
      const filtered = currentMessages.filter((m: Msg) => m.id !== optimisticMessage.id)

      // Check if saved message already exists (from Socket.io event)
      const exists = filtered.some((m: Msg) => m.id === savedMessage.id)
      if (!exists) {
        upsertMessages(roomId, [savedMessage])
      } else {
        // Already added via Socket.io, just remove optimistic
        setRoom(roomId, { messages: filtered })
      }
    } catch (err: any) {
      // Remove optimistic message on error
      const currentMessages = room?.messages ?? []
      const filtered = currentMessages.filter((m: Msg) => m.id !== optimisticMessage.id)
      setRoom(roomId, { messages: filtered })

      setError(err.message || 'Failed to send message')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!session?.user) {
    return <div className="text-slate-400">Please sign in to chat</div>
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 min-h-0">
      {/* Header - stays stable when switching rooms */}
      <div className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <h2 className="text-xl font-semibold">{roomName}</h2>
        <PresenceBar roomId={roomId} />
      </div>

      {/* Messages - only this area updates when switching rooms */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-6 space-y-4 min-h-0 ${isRestoringScroll ? 'invisible' : ''}`}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {(isLoadingMessages && !(room?.messages?.length)) ? (
          // Only show loader if there's NO cache to display
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Loading messages...</div>
          </div>
        ) : (
          <>
            {messages
              .filter((m) => m.user?.id) // Filter out messages without user.id
              .map((m) => (
                <MessageItem 
                  key={m.id} 
                  message={m} 
                  currentUserId={session.user!.id} 
                />
              ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input - stays stable when switching rooms */}
      <div className="px-6 py-4 border-t border-slate-800 flex-shrink-0">
        {error && showToast && (
          <div className="mb-2 text-red-400 text-sm">{error}</div>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={isLoading || isSwitchingRoom}
            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || isSwitchingRoom}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors flex-shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
