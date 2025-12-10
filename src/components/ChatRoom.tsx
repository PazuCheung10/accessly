'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { initSocket } from '@/lib/socket'
import { useChatStore, Message as Msg } from '@/lib/chatStore'
import { isNearBottom, scrollToBottom, preserveScrollOnPrepend } from '@/lib/scroll'
import { MessageItem } from './MessageItem'
import { ThreadView } from './ThreadView'
import { PresenceBar } from './PresenceBar'
import { RoomHeader } from './rooms/RoomHeader'

// Store unsent messages per room (outside component to persist across re-renders)
const unsentMessages: Record<string, string> = {}

interface ChatRoomProps {
  roomId: string
  roomName: string
}

export function ChatRoom({ roomId, roomName }: ChatRoomProps) {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Subscribe to the room slice directly (not via getter method)
  const room = useChatStore((s) => s.rooms[roomId])
  const setRoom = useChatStore((s) => s.setRoom)
  const upsertMessages = useChatStore((s) => s.upsertMessages)
  const toggleThread = useChatStore((s) => s.toggleThread)
  const isThreadExpanded = useChatStore((s) => s.isThreadExpanded)

  const messages: Msg[] = room?.messages ?? []
  
  // Get thread ID from URL
  const threadId = searchParams.get('thread')
  
  // Track replying to a message
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const [input, setInput] = useState(() => unsentMessages[roomId] || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [isRestoringScroll, setIsRestoringScroll] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map()) // userId -> userName

  // Use session user ID directly (removed /api/debug/session fetch to avoid test conflicts)
  const currentUserId = session?.user?.id ?? null
  
  // Typing indicator debounce
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingEmitRef = useRef<number>(0)
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitialisedRef = useRef(false) // for this room lifecycle
  const currentRoomIdRef = useRef<string>(roomId)
  const prevRoomIdRef = useRef<string | null>(null)
  const inputRef = useRef<string>(input)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false) // For pagination indicator
  const isRestoringScrollRef = useRef(false) // Track if we're restoring scroll
  const isInitialFetchingRef = useRef(false) // Track if we're doing the initial fetch for this room

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

  // 1) CRITICAL: Save previous room's scroll BEFORE roomId changes
  // This must run BEFORE the restore useLayoutEffect to prevent race conditions
  useLayoutEffect(() => {
    // Save scroll position of previous room BEFORE switching
    if (prevRoomIdRef.current && prevRoomIdRef.current !== roomId) {
      const el = messagesContainerRef.current
      if (el && hasInitialisedRef.current) {
        // Save the scroll position of the previous room
        const scrollTop = el.scrollTop
        setRoom(prevRoomIdRef.current, { scrollTop })
        console.log('💾 Saved scroll for previous room:', prevRoomIdRef.current, 'scrollTop:', scrollTop)
      }
    }
  }, [roomId, setRoom])

  // 2) Save scrollTop when unmounting (cleanup)
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
    // First mount (prevRoomIdRef.current === null) also counts as "should restore"
    const shouldRestore = prevRoomIdRef.current === null || prevRoomIdRef.current !== roomId
    if (!shouldRestore) {
      // Room hasn't changed, don't restore
      return
    }

    // Save previous room's scroll one more time (safety net) BEFORE updating prevRoomIdRef
    const previousRoomId = prevRoomIdRef.current
    if (previousRoomId && previousRoomId !== roomId && hasInitialisedRef.current) {
      const scrollTop = el.scrollTop
      setRoom(previousRoomId, { scrollTop })
      console.log('💾 Safety net: Saved scroll for previous room:', previousRoomId, 'scrollTop:', scrollTop)
    }

    // Reset initial fetch tracking when room changes
    isInitialFetchingRef.current = false
    hasInitialisedRef.current = false

    // NOTE: Don't update prevRoomIdRef here - it will be updated after restore completes
    // This ensures the save useLayoutEffect can still detect the room change

    // If room exists in cache (even if empty), render immediately (no loader)
    if (room) {
      // 1) Render cached messages immediately (no loader, even if empty)
      setIsLoadingMessages(false)

      // 2) Restore scroll position (synchronously BEFORE paint to prevent flash)
      // Check if we have a saved scroll position (including 0 for empty rooms)
      const hasSavedScroll = room.scrollTop !== null && room.scrollTop !== undefined
      
      if (hasSavedScroll) {
        // We have a saved scroll position (even if 0 for empty room)
        // Hide container during restore to prevent flash
        setIsRestoringScroll(true)
        isRestoringScrollRef.current = true
        
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
              setIsRestoringScroll(false)
              isRestoringScrollRef.current = false
              hasInitialisedRef.current = true
              // Update prevRoomIdRef after restore completes - this marks the room as "current"
              prevRoomIdRef.current = roomId
              console.log('✅ Restored scroll for room:', roomId, 'scrollTop:', savedScroll)
            }
          })
        })
      } else {
        // First visit to this room (no saved scroll position)
        // Hide container during initial scroll to prevent flash
        setIsRestoringScroll(true)
        isRestoringScrollRef.current = true
        
        if (room.messages?.length) {
          // Has messages → wait for DOM, then snap to bottom synchronously
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!messagesContainerRef.current) return
              const box = messagesContainerRef.current
              // Force reflow to ensure scrollHeight is accurate
              void box.offsetHeight
              // Set scroll to bottom synchronously
              box.scrollTop = box.scrollHeight
              // Save scroll position after setting
              setRoom(roomId, { scrollTop: box.scrollTop })
              // Show container (no flash - scroll is already set)
              setIsRestoringScroll(false)
              isRestoringScrollRef.current = false
              hasInitialisedRef.current = true
              // Update prevRoomIdRef after restore completes
              prevRoomIdRef.current = roomId
              console.log('✅ First visit: Scrolled to bottom for room:', roomId, 'scrollTop:', box.scrollTop)
            })
          })
        } else {
          // Empty room - set to top immediately and save to cache
          el.scrollTop = 0
          setRoom(roomId, { scrollTop: 0 }) // Save scrollTop = 0 for empty room
          setIsRestoringScroll(false)
          isRestoringScrollRef.current = false
          hasInitialisedRef.current = true
          // Update prevRoomIdRef after restore completes
          prevRoomIdRef.current = roomId
          console.log('✅ Empty room: Set scrollTop to 0 for room:', roomId)
        }
      }
    } else {
      // No cache → show loader on first visit only
      setIsLoadingMessages(true)
    }
    // Watch only roomId and messages length, NOT scrollTop (to avoid re-running on scroll)
  }, [roomId, room?.messages?.length, room, setRoom])

  // 4.3a Handle scroll when messages first appear (for non-cached rooms)
  useLayoutEffect(() => {
    // Only handle scroll for rooms that just got messages
    // Container is already hidden from fetchInitial
    // Don't check for room existence - messages might have just arrived
    if (!messages.length || hasInitialisedRef.current) return
    if (!isRestoringScrollRef.current) return // Only if we're in restore mode
    
    const el = messagesContainerRef.current
    if (!el || isLoadingMessages) return
    
    // Wait for layout, then scroll to bottom synchronously
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!messagesContainerRef.current) return
        const box = messagesContainerRef.current
        
        // Force reflow to ensure scrollHeight is accurate
        void box.offsetHeight
        
        // Scroll to bottom synchronously (before showing container)
        box.scrollTop = box.scrollHeight
        
        // Save scroll position
        setRoom(roomId, { scrollTop: box.scrollTop })
        
        // Show container (no flash - scroll is already set)
        setIsRestoringScroll(false)
        isRestoringScrollRef.current = false
      })
    })
  }, [roomId, messages.length, room, isLoadingMessages, setRoom])

  // 4.3 Initial fetch if needed
  useEffect(() => {
    if (!session?.user?.id) return

    // Check if we have messages (not just if room exists)
    const hasMessages = !!room && Array.isArray(room.messages) && room.messages.length > 0

    if (hasMessages) {
      // Only fetch newer if we already have some messages
      void fetchNewerAfter()
      return
    }

    // No room or no messages yet → fetch initial page
    void fetchInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, session?.user?.id])

  // 4.4 Socket for live messages and updates (only affect current room)
  useEffect(() => {
    if (!session?.user?.id) return

    const socket = initSocket(session.user.id)

    const handleMessageNew = (m: Msg) => {
      if (m.roomId !== roomId) return

      // Allow system / imported messages without user.id
      if (process.env.NODE_ENV !== 'production') {
        console.log('📨 Socket message received:', {
          messageId: m.id,
          roomId: m.roomId,
          userId: m.userId,
          hasUser: !!m.user,
          userFromMessage: m.user?.id,
          parentMessageId: m.parentMessageId,
        })
      }
      
      // Check if message already exists (from optimistic update or previous socket event)
      const currentMessages = useChatStore.getState().rooms[roomId]?.messages ?? []
      const exists = currentMessages.some((msg: Msg) => msg.id === m.id)
      
      if (exists) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('⚠️ Message already exists, skipping socket update:', m.id)
        }
        return
      }

      const el = messagesContainerRef.current
      const atBottom = el ? isNearBottom(el, 100) : true

      upsertMessages(roomId, [m])

      // If it's a reply and the thread is expanded, auto-expand if not already
      if (m.parentMessageId && !isThreadExpanded(roomId, m.parentMessageId)) {
        toggleThread(roomId, m.parentMessageId)
      }

      // Only snap to bottom if at/near bottom already (or if it's a reply to an expanded thread)
      if (el && (atBottom || (m.parentMessageId && isThreadExpanded(roomId, m.parentMessageId)))) {
        scrollToBottom(el)
        setRoom(roomId, { scrollTop: el.scrollTop })
      }
    }

    const handleMessageEdit = (data: { id: string; roomId: string; content: string; editedAt: string }) => {
      if (data.roomId !== roomId) return

      const currentMessages = useChatStore.getState().rooms[roomId]?.messages ?? []
      const updated = currentMessages.map((msg) =>
        msg.id === data.id
          ? { ...msg, content: data.content, editedAt: data.editedAt }
          : msg
      )
      setRoom(roomId, { messages: updated })
    }

    const handleMessageDelete = (data: { id: string; roomId: string; deletedAt: string }) => {
      if (data.roomId !== roomId) return

      const currentMessages = useChatStore.getState().rooms[roomId]?.messages ?? []
      const updated = currentMessages.map((msg) =>
        msg.id === data.id
          ? { ...msg, content: '[Message deleted]', deletedAt: data.deletedAt }
          : msg
      )
      setRoom(roomId, { messages: updated })
    }

    const handleMessageReaction = (data: { id: string; roomId: string; reactions: Record<string, string[]> }) => {
      if (data.roomId !== roomId) return

      const currentMessages = useChatStore.getState().rooms[roomId]?.messages ?? []
      const updated = currentMessages.map((msg) =>
        msg.id === data.id
          ? { ...msg, reactions: data.reactions }
          : msg
      )
      setRoom(roomId, { messages: updated })
    }

    const handleTypingStart = (data: { userId: string; userName: string }) => {
      if (data.userId === currentUserId || data.userId === session.user?.id) return
      
      // Clear existing timeout for this user
      const existingTimeout = typingTimeouts.current.get(data.userId)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      setTypingUsers((prev) => {
        const next = new Map(prev)
        next.set(data.userId, data.userName || data.userId)
        return next
      })

      // Auto-clear typing indicator after 5 seconds of inactivity
      const timeout = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev)
          next.delete(data.userId)
          return next
        })
        typingTimeouts.current.delete(data.userId)
      }, 5000)

      typingTimeouts.current.set(data.userId, timeout)
    }

    const handleTypingStop = (data: { userId: string }) => {
      if (data.userId === currentUserId || data.userId === session.user?.id) return
      
      // Clear timeout
      const timeout = typingTimeouts.current.get(data.userId)
      if (timeout) {
        clearTimeout(timeout)
        typingTimeouts.current.delete(data.userId)
      }

      setTypingUsers((prev) => {
        const next = new Map(prev)
        next.delete(data.userId)
        return next
      })
    }

    socket.on('message:new', handleMessageNew)
    socket.on('message:edit', handleMessageEdit)
    socket.on('message:delete', handleMessageDelete)
    socket.on('message:reaction', handleMessageReaction)
    socket.on('typing:start', handleTypingStart)
    socket.on('typing:stop', handleTypingStop)
    socket.emit('room:join', { roomId, userId: session.user.id })

    return () => {
      socket.off('message:new', handleMessageNew)
      socket.off('message:edit', handleMessageEdit)
      socket.off('message:delete', handleMessageDelete)
      socket.off('message:reaction', handleMessageReaction)
      socket.off('typing:start', handleTypingStart)
      socket.off('typing:stop', handleTypingStop)
      socket.emit('room:leave', { roomId, userId: session.user.id })
    }
  }, [roomId, session?.user?.id, currentUserId, upsertMessages, setRoom])

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
      // keep all messages; do not filter by user.id
      const older: Msg[] = json.data?.messages ?? json.messages ?? []

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
      if (!res || typeof res.json !== 'function') {
        console.error('Invalid response when fetching newer messages')
        return
      }
      const json = await res.json()
      // keep all messages; do not filter by user.id
      const newer: Msg[] = json.data?.messages ?? json.messages ?? []

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
    
    // Mark that we're doing the initial fetch
    isInitialFetchingRef.current = true
    
    // Hide container BEFORE fetching to prevent flash
    setIsRestoringScroll(true)
    isRestoringScrollRef.current = true
    
    try {
      // Ensure loading state is true (might already be, but be explicit)
      setIsLoadingMessages(true)
      
      // DEBUG: Log roomId being used for messages API (development only)
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEBUG ChatRoom fetchInitial messages', {
          roomId,
          roomName,
        })
      }
      
      const res = await fetch(`/api/chat/messages?roomId=${roomId}&limit=50`)
      // Be forgiving so tests don't break
      if (!res || typeof res.json !== 'function') {
        setIsLoadingMessages(false)
        setIsRestoringScroll(false)
        isRestoringScrollRef.current = false
        return
      }
      const json = await res.json()
      
      // DEBUG: Log raw JSON response (development only)
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEBUG ChatRoom fetchInitial raw JSON', {
          roomId,
          ok: json.ok,
          hasData: !!json.data,
          flatCount: json.data?.messages?.length ?? json.messages?.length ?? 0,
          hierarchicalCount: json.data?.hierarchicalMessages?.length ?? 0,
        })
      }
      
      // Check if API returned an error
      if (!json.ok) {
        console.error('❌ Messages API error:', {
          code: json.code,
          message: json.message,
          roomId,
          roomName,
        })
        setError(json.message || 'Failed to load messages')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
        setIsLoadingMessages(false)
        setIsRestoringScroll(false)
        isRestoringScrollRef.current = false
        return
      }
      
      // Use hierarchical messages if available, otherwise fall back to flat
      const hierarchical = json.data?.hierarchicalMessages
      if (hierarchical) {
        // Flatten hierarchical structure for storage
        const flatMsgs: Msg[] = hierarchical.flatMap((msg: any) => {
          const base: Msg = {
            ...msg,
            replies: msg.replies || []
          }
          return [base, ...(msg.replies || [])]
        })
        // keep all messages; do not filter by user.id
        msgs = flatMsgs
      } else {
        // keep all messages; do not filter by user.id
        msgs = json.data?.messages ?? json.messages ?? []
      }

      // DEBUG: Log messages before upsert (development only)
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEBUG ChatRoom fetchInitial msgs before upsert', {
          roomId,
          count: msgs.length,
          ids: msgs.map(m => m.id),
        })
      }

      // Store messages (even if empty); also set cursor & lastMessageId
      // Note: upsertMessages will create room entry, but we track initial fetch with ref
      const oldest = msgs[0]?.id ?? null
      const newest = msgs[msgs.length - 1]?.id ?? null
      upsertMessages(roomId, msgs)
      setRoom(roomId, { cursor: oldest, lastMessageId: newest })
      
      // Handle URL deep-linking: expand thread if threadId is in URL
      if (threadId) {
        toggleThread(roomId, threadId)
        // Scroll to thread after messages are rendered
        setTimeout(() => {
          const element = document.getElementById(`message-${threadId}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          } else {
            // If element not found, try scrolling after a longer delay
            setTimeout(() => {
              const retryElement = document.getElementById(`message-${threadId}`)
              if (retryElement) {
                retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }, 500)
          }
        }, 200)
      }
    } catch (err) {
      console.error('Error fetching initial messages:', err)
      setError('Failed to load messages')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      // Mark that initial fetch is complete
      isInitialFetchingRef.current = false
      
      // Set loading to false
      setIsLoadingMessages(false)
      
      // Note: Scroll handling is done in useLayoutEffect when messages appear
      // Container visibility is controlled by isRestoringScroll state
      
      // For empty rooms, we can show immediately
      if (msgs.length === 0) {
        const el = messagesContainerRef.current
        if (el) {
          el.scrollTop = 0
          setRoom(roomId, { scrollTop: 0 })
        }
        setIsRestoringScroll(false)
        isRestoringScrollRef.current = false
        hasInitialisedRef.current = true
      } else {
        // First-time messages: snap to bottom *now* and unhide.
        // This ensures the container is visible immediately after the first fetch
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = messagesContainerRef.current
            if (!el) return
            
            // Force reflow to ensure scrollHeight is accurate
            void el.offsetHeight
            
            // Scroll to bottom synchronously (before showing container)
            el.scrollTop = el.scrollHeight
            
            // Save scroll position
            setRoom(roomId, { scrollTop: el.scrollTop })
            
            // Show container (no flash - scroll is already set)
            setIsRestoringScroll(false)
            isRestoringScrollRef.current = false
            hasInitialisedRef.current = true
            // Update prevRoomIdRef after initial fetch completes
            prevRoomIdRef.current = roomId
            
            // Optional: immediately poll for any very-new messages
            void fetchNewerAfter()
          })
        })
      }
    }
  }

  // Handle reply to a message
  const handleReply = (messageId: string) => {
    setReplyingTo(messageId)
    // Update URL to include thread parameter
    const params = new URLSearchParams(searchParams.toString())
    params.set('thread', messageId)
    router.push(`?${params.toString()}`, { scroll: false })
    // Expand thread if not already expanded
    if (!isThreadExpanded(roomId, messageId)) {
      toggleThread(roomId, messageId)
    }
    // Focus input
    setTimeout(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
      if (textarea) textarea.focus()
    }, 100)
  }

  // Send message function
  const sendMessage = async () => {
    if (!input.trim() || !session?.user?.id) return

    const content = input.trim()
    const parentMessageId = replyingTo
    setInput('')
    setReplyingTo(null)
    unsentMessages[roomId] = ''
    setIsLoading(true)
    setError(null)
    setSendError(null)
    
    // Clear thread parameter from URL if replying
    if (parentMessageId) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('thread')
      router.push(`?${params.toString()}`, { scroll: false })
    }

    // Use session user ID for optimistic message
    const optimisticUserId = session.user.id
    
    // Optimistic update
    const optimisticMessage: Msg = {
      id: `temp-${Date.now()}`,
      roomId,
      userId: optimisticUserId,
      content,
      parentMessageId: parentMessageId || null,
      createdAt: new Date().toISOString(),
      user: {
        id: optimisticUserId, // Use DB user ID so it matches the real message
        name: session.user.name,
        image: session.user.image,
      },
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('📤 Sending message (optimistic):', {
        tempId: optimisticMessage.id,
        userId: optimisticUserId,
        content,
        parentMessageId,
      })
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
          parentMessageId: parentMessageId || null,
        }),
      })

      if (!response || typeof response.json !== 'function') {
        setSendError('Failed to send')
        // Remove optimistic message
        const currentMessages = room?.messages ?? []
        const filtered = currentMessages.filter((m: Msg) => m.id !== optimisticMessage.id)
        setRoom(roomId, { messages: filtered })
        setIsLoading(false)
        return
      }

      const data = await response.json()

      if (!response.ok || !data.ok) {
        const errorMessage = data.code === 'RATE_LIMITED'
          ? 'Rate limit exceeded'
          : data.message || data.error || 'Failed to send'
        setSendError(errorMessage)
        setError(errorMessage)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
        // Remove optimistic message
        const currentMessages = room?.messages ?? []
        const filtered = currentMessages.filter((m: Msg) => m.id !== optimisticMessage.id)
        setRoom(roomId, { messages: filtered })
        setIsLoading(false)
        return
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

      if (process.env.NODE_ENV !== 'production') {
        console.log('📥 API response received:', {
          savedMessageId: savedMessage.id,
          savedUserId: savedMessage.user?.id,
          optimisticId: optimisticMessage.id,
        })
      }

      // Check if saved message already exists (from Socket.io event)
      const exists = filtered.some((m: Msg) => m.id === savedMessage.id)
      if (!exists) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Adding saved message from API response:', savedMessage.id)
        }
        // Replace optimistic with real message
        const updated = [...filtered, savedMessage]
        setRoom(roomId, { messages: updated })
      } else {
        // Already added via Socket.io, just remove optimistic
        if (process.env.NODE_ENV !== 'production') {
          console.log('⚠️ Message already exists from socket, just removing optimistic:', savedMessage.id)
        }
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

  // Handle typing indicator with debounce
  const emitTyping = () => {
    if (!session?.user?.id) return

    const now = Date.now()
    // Throttle typing events to max once per 3 seconds
    if (now - lastTypingEmitRef.current < 3000) return

    lastTypingEmitRef.current = now
    const socket = initSocket(session.user.id)
    socket.emit('typing:start', {
      roomId,
      userId: session.user.id,
      userName: session.user.name || session.user.email || 'Someone',
    })

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing after 5 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', {
        roomId,
        userId: session.user.id,
      })
    }, 5000)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    emitTyping()
  }

  const handleInputFocus = () => {
    emitTyping()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      if (session?.user?.id) {
        const socket = initSocket(session.user.id)
        socket.emit('typing:stop', {
          roomId,
          userId: session.user.id,
        })
      }
      sendMessage()
    } else {
      emitTyping()
    }
  }

  if (!session?.user) {
    return <div className="text-slate-400">Please sign in to chat</div>
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 min-h-0">
      {/* Header with room details, badges, and actions */}
      <RoomHeader roomId={roomId} roomName={roomName} />
      <div className="px-6 pb-2 border-b border-slate-800 flex-shrink-0">
        <PresenceBar roomId={roomId} />
      </div>

      {/* Send error display */}
      {sendError && (
        <div className="px-6 py-2 text-sm text-red-400 bg-red-500/10 border-b border-red-500/30">
          {sendError}
        </div>
      )}

      {/* Messages - only this area updates when switching rooms */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0"
        style={{ 
          scrollBehavior: 'auto',
          visibility: isRestoringScroll ? 'hidden' : 'visible'
        }}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {(isLoadingMessages && (!room || isInitialFetchingRef.current)) ? (
          // Show loader on first visit (no cache) OR during initial fetch (even if room entry exists)
          // This handles the case where upsertMessages creates room entry before fetch completes
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
            {(() => {
              // do not filter by user.id — allow system messages
              // Filter to only root messages (no parentMessageId)
              const rootMessages = messages.filter((m) => !m.parentMessageId)
              
              return rootMessages.map((m) => {
                // Get replies for this message
                const replies = messages.filter((reply) => reply.parentMessageId === m.id)
                const replyCount = replies.length
                const expanded = isThreadExpanded(roomId, m.id)
                
                return (
                  <div key={m.id} id={`message-${m.id}`}>
                    <MessageItem 
                      message={m} 
                      currentUserId={currentUserId || session.user!.id}
                      roomId={roomId}
                      onMessageUpdate={(messageId, updates) => {
                        const currentMessages = useChatStore.getState().rooms[roomId]?.messages ?? []
                        const updated: Msg[] = currentMessages.map((msg) =>
                          msg.id === messageId ? { ...msg, ...updates } as Msg : msg
                        )
                        setRoom(roomId, { messages: updated })
                      }}
                      onReply={handleReply}
                      replyCount={replyCount}
                    />
                    {/* Show thread if expanded or if URL has thread parameter */}
                    {(expanded || threadId === m.id) && replyCount > 0 && (
                      <ThreadView
                        parentMessage={m}
                        replies={replies}
                        currentUserId={currentUserId || session.user!.id}
                        roomId={roomId}
                        onMessageUpdate={(messageId, updates) => {
                          const currentMessages = useChatStore.getState().rooms[roomId]?.messages ?? []
                          const updated: Msg[] = currentMessages.map((msg) =>
                            msg.id === messageId ? { ...msg, ...updates } as Msg : msg
                          )
                          setRoom(roomId, { messages: updated })
                        }}
                        onReply={handleReply}
                      />
                    )}
                  </div>
                )
              })
            })()}
            {typingUsers.size > 0 && (
              <div className="text-xs text-slate-500 italic py-2">
                {Array.from(typingUsers.values()).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input - stays stable when switching rooms */}
      <div className="px-6 py-4 border-t border-slate-800 flex-shrink-0">
        {/* Only show error toast here if sendError is not set (sendError is shown above) */}
        {!sendError && error && showToast && (
          <div className="mb-2 text-red-400 text-sm">{error}</div>
        )}
        <div className="flex gap-2">
          {replyingTo && (() => {
            const replyingToMessage = messages.find((m) => m.id === replyingTo)
            return (
              <div className="mb-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 flex items-center justify-between">
                <span>
                  Replying to <span className="font-medium">{replyingToMessage?.user?.name || 'message'}</span>
                  {replyingToMessage?.content && (
                    <span className="text-slate-500 ml-2">
                      {replyingToMessage.content.slice(0, 50)}
                      {replyingToMessage.content.length > 50 ? '...' : ''}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => {
                    setReplyingTo(null)
                    const params = new URLSearchParams(searchParams.toString())
                    params.delete('thread')
                    router.push(`?${params.toString()}`, { scroll: false })
                  }}
                  className="text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
            )
          })()}
          <textarea
            value={input}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyPress={handleKeyPress}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleKeyPress(e as any)
              }
            }}
            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
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
