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
  
  // Get DB user ID for comparison (fetch on mount)
  const [dbUserId, setDbUserId] = useState<string | null>(null)
  
  useEffect(() => {
    if (session?.user?.email) {
      // Fetch DB user ID to match message user IDs
      fetch('/api/debug/session')
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.dbUser?.id) {
            setDbUserId(data.dbUser.id)
            console.log('🔑 DB User ID loaded:', data.dbUser.id, 'Session ID:', session.user.id)
          }
        })
        .catch(err => console.error('Failed to fetch DB user ID:', err))
    }
  }, [session?.user?.email])

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitialisedRef = useRef(false) // for this room lifecycle
  const currentRoomIdRef = useRef<string>(roomId)
  const prevRoomIdRef = useRef(roomId)
  const inputRef = useRef<string>(input)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false) // For pagination indicator
  const isRestoringScrollRef = useRef(false) // Track if we're restoring scroll

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

  // 3) Restore scroll after paint (double rAF) for cached messages
  useLayoutEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return

    // Only restore scroll when roomId changes, not on every scrollTop update
    const shouldRestore = prevRoomIdRef.current !== roomId
    if (!shouldRestore) {
      // Room hasn't changed, don't restore
      return
    }

    hasInitialisedRef.current = false

    // If room exists in cache (even if empty), render immediately (no loader)
    if (room) {
      // 1) Render cached messages immediately (no loader, even if empty)
      setIsLoadingMessages(false)
      // Notify parent immediately that we're done loading (cached room)
      onMessagesLoaded?.()

      // 2) Restore scroll position (synchronously BEFORE paint to prevent flash)
      // Check if we have a saved scroll position (including 0 for empty rooms)
      const hasSavedScroll = room.scrollTop !== null && room.scrollTop !== undefined
      
      if (hasSavedScroll) {
        // We have a saved scroll position (even if 0 for empty room)
        // Hide container during restore to prevent flash
        isRestoringScrollRef.current = true
        el.style.visibility = 'hidden'
        
        // Force a reflow to ensure layout is calculated
        void el.offsetHeight
        
        // Set scroll immediately (synchronously) - 0 is valid for empty rooms
        el.scrollTop = room.scrollTop!
        
        // Show container after scroll is set (double rAF to ensure layout is complete)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
              // Ensure scroll position is correct
              const savedScroll = room.scrollTop!
              if (messagesContainerRef.current.scrollTop !== savedScroll) {
                messagesContainerRef.current.scrollTop = savedScroll
              }
              // Show container (no flash - scroll is already set)
              messagesContainerRef.current.style.visibility = 'visible'
              isRestoringScrollRef.current = false
              hasInitialisedRef.current = true
            }
          })
        })
      } else {
        // First visit to this room (no saved scroll position)
        if (room.messages?.length) {
          // Has messages → wait for DOM, then snap to bottom
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!messagesContainerRef.current) return
              const box = messagesContainerRef.current
              box.scrollTop = box.scrollHeight
              // Save scroll position after setting
              setRoom(roomId, { scrollTop: box.scrollTop })
              hasInitialisedRef.current = true
            })
          })
        } else {
          // Empty room - set to top immediately and save to cache
          el.scrollTop = 0
          setRoom(roomId, { scrollTop: 0 }) // Save scrollTop = 0 for empty room
          hasInitialisedRef.current = true
        }
      }
    } else {
      // No cache → show loader on first visit only
      setIsLoadingMessages(true)
    }
    // Watch only roomId and messages length, NOT scrollTop (to avoid re-running on scroll)
  }, [roomId, room?.messages?.length, room, onMessagesLoaded, setRoom])

  // 4.3 Initial fetch if needed
  useEffect(() => {
    if (!session?.user?.id) return

    // If room exists in cache (even if empty), don't fetch again
    // Note: onMessagesLoaded() is already called in useLayoutEffect for cached rooms
    if (room) {
      // optional: fetch incrementals after initial paint (only if we have messages)
      if (room.messages?.length) {
        void fetchNewerAfter()
      }
      // Don't call onMessagesLoaded() here - already called in useLayoutEffect
      return
    }

    // No cache → fetch initial messages
    void fetchInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, session?.user?.id])

  // 4.4 Socket for live messages (only affect current room)
  useEffect(() => {
    if (!session?.user?.id) return

    const socket = initSocket(session.user.id)

    const handleMessageNew = (m: Msg) => {
      if (m.roomId !== roomId || !m.user?.id) return

      console.log('📨 Socket message received:', {
        messageId: m.id,
        roomId: m.roomId,
        userId: m.userId,
        userFromMessage: m.user?.id,
      })
      
      // Check if message already exists (from optimistic update or previous socket event)
      const currentMessages = useChatStore.getState().rooms[roomId]?.messages ?? []
      const exists = currentMessages.some((msg: Msg) => msg.id === m.id)
      
      if (exists) {
        console.log('⚠️ Message already exists, skipping socket update:', m.id)
        return
      }

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
      setIsLoadingOlder(true) // Show inline indicator, not full-screen loader

      const res = await fetch(`/api/chat/messages?roomId=${roomId}&limit=50&cursor=${currentCursor}`)
      const json = await res.json()
      const older: Msg[] = (json.data?.messages ?? json.messages ?? []).filter((m: Msg) => m.user?.id)

      if (older.length === 0) return

      // Prepend older with anchored scroll (preserves viewport)
      preserveScrollOnPrepend(el, () => {
        upsertMessages(roomId, older, { asPrepend: true })
      })

      // Update cursor to the new oldest
      const newOldest = older[0]?.id ?? currentCursor
      setRoom(roomId, { cursor: newOldest })
    } catch (err) {
      console.error('Error fetching older messages:', err)
    } finally {
      setIsLoadingOlder(false)
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
    let msgs: Msg[] = []
    try {
      setIsLoadingMessages(true)
      const res = await fetch(`/api/chat/messages?roomId=${roomId}&limit=50`)
      const json = await res.json()
      msgs = (json.data?.messages ?? json.messages ?? []).filter((m: Msg) => m.user?.id)

      // Store messages (even if empty); also set cursor & lastMessageId
      const oldest = msgs[0]?.id ?? null
      const newest = msgs[msgs.length - 1]?.id ?? null
      // Create room entry in cache (even if empty) so we don't fetch again
      setRoom(roomId, { cursor: oldest, lastMessageId: newest })
      upsertMessages(roomId, msgs)
    } catch (err) {
      console.error('Error fetching initial messages:', err)
      setError('Failed to load messages')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setIsLoadingMessages(false)

      // Now that they've rendered, snap to bottom instantly (or top for empty room)
      const el = messagesContainerRef.current
      if (el) {
        if (msgs.length > 0) {
          scrollToBottom(el) // immediate (no smooth)
        } else {
          // Empty room - set to top
          el.scrollTop = 0
        }
        // Save scroll position (even if 0 for empty room) so we can restore it later
        setRoom(roomId, { scrollTop: el.scrollTop })
      }

      hasInitialisedRef.current = true
      onMessagesLoaded?.()

      // Optional: immediately poll for any very-new messages (only if we have messages)
      if (msgs.length > 0) {
        void fetchNewerAfter()
      }
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

    // Use DB user ID for optimistic message if available, otherwise session ID
    const optimisticUserId = dbUserId || session.user.id
    
    // Optimistic update
    const optimisticMessage: Msg = {
      id: `temp-${Date.now()}`,
      roomId,
      userId: optimisticUserId,
      content,
      createdAt: new Date().toISOString(),
      user: {
        id: optimisticUserId, // Use DB user ID so it matches the real message
        name: session.user.name,
        image: session.user.image,
      },
    }

    console.log('📤 Sending message (optimistic):', {
      tempId: optimisticMessage.id,
      userId: optimisticUserId,
      content,
    })

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

      // Remove optimistic and add real message
      const currentMessages = useChatStore.getState().rooms[roomId]?.messages ?? []
      const filtered = currentMessages.filter((m: Msg) => m.id !== optimisticMessage.id)

      console.log('📥 API response received:', {
        savedMessageId: savedMessage.id,
        savedUserId: savedMessage.user?.id,
        optimisticId: optimisticMessage.id,
      })

      // Check if saved message already exists (from Socket.io event)
      const exists = filtered.some((m: Msg) => m.id === savedMessage.id)
      if (!exists) {
        console.log('✅ Adding saved message from API response:', savedMessage.id)
        // Replace optimistic with real message
        const updated = [...filtered, savedMessage]
        setRoom(roomId, { messages: updated })
      } else {
        // Already added via Socket.io, just remove optimistic
        console.log('⚠️ Message already exists from socket, just removing optimistic:', savedMessage.id)
        setRoom(roomId, { messages: filtered })
      }
      
      // Scroll to bottom after adding message
      const el = messagesContainerRef.current
      if (el) {
        scrollToBottom(el)
        setRoom(roomId, { scrollTop: el.scrollTop })
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
        className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0"
        style={{ scrollBehavior: 'auto' }}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {(isLoadingMessages && !room) ? (
          // Only show loader on first visit to a room (no cache at all)
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Loading messages...</div>
          </div>
        ) : (
          <>
            {/* Inline pagination indicator (subtle, at top) */}
            {isLoadingOlder && (
              <div className="text-center py-2 text-sm text-slate-500">
                Loading older messages...
              </div>
            )}
            {messages
              .filter((m) => m.user?.id) // Filter out messages without user.id
              .map((m) => (
                <MessageItem 
                  key={m.id} 
                  message={m} 
                  currentUserId={dbUserId || session.user!.id} 
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
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors flex-shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
