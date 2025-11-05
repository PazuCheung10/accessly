'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { initSocket, getSocket, disconnectSocket } from '@/lib/socket'
import { MessageItem } from './MessageItem'
import { PresenceBar } from './PresenceBar'
import { Toast } from './Toast'

interface Message {
  id: string
  roomId: string
  userId: string
  content: string
  createdAt: string
  user: {
    id: string
    name: string | null
    image: string | null
  }
}

interface ChatRoomProps {
  roomId: string
  roomName: string
}

export function ChatRoom({ roomId, roomName }: ChatRoomProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session?.user?.id) return

    // Initialize socket connection
    const socket = initSocket(session.user.id)

    // Join room
    socket.emit('room:join', { roomId, userId: session.user.id })

    // Listen for new messages
    socket.on('message:new', (message: Message) => {
      // Ensure message has user object with id
      if (message.user?.id) {
        setMessages((prev) => {
          // Deduplicate: check if message already exists (avoid duplicates from API + Socket)
          const exists = prev.some((m) => m.id === message.id)
          if (exists) {
            return prev // Message already in list, don't add again
          }
          return [...prev, message]
        })
      } else {
        console.warn('Received message without user.id:', message)
      }
    })

    // Load initial messages
    fetchMessages()

    return () => {
      socket.emit('room:leave', { roomId, userId: session.user.id })
      disconnectSocket()
    }
  }, [roomId, session?.user?.id])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/chat/messages?roomId=${roomId}&limit=50`)
      if (!response.ok) {
        throw new Error('Failed to load messages')
      }
      const data = await response.json()
      // API returns { ok: true, data: { messages: [...] } }
      const rawMessages = data.data?.messages || data.messages || []
      
      // Filter out messages without valid user.id
      const validMessages = rawMessages.filter((msg: Message) => {
        if (!msg.user?.id) {
          console.warn('Message missing user.id, filtering out:', msg)
          return false
        }
        return true
      })
      
      setMessages(validMessages)
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError('Failed to load messages')
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !session?.user?.id) return

    const content = input.trim()
    setInput('')
    setIsLoading(true)
    setError(null)

    // Optimistic update
    const optimisticMessage: Message = {
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
    setMessages((prev) => [...prev, optimisticMessage])

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

      // Check if API returned an error response
      // API returns { ok: false, message: '...' } for errors
      if (!response.ok || !data.ok) {
        const errorMessage = data.message || data.error || 'Failed to send message'
        throw new Error(errorMessage)
      }

      // Remove optimistic message and add real one
      // API returns { ok: true, data: { ...message } }
      const savedMessage = data.data
      
      // Validate saved message structure
      if (!savedMessage || typeof savedMessage !== 'object') {
        console.error('Invalid saved message format:', savedMessage)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id))
        throw new Error('Invalid message format from server')
      }
      
      // Ensure saved message has user object with id
      if (!savedMessage.user || !savedMessage.user.id) {
        console.error('Saved message missing user.id:', savedMessage)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id))
        throw new Error('Invalid message format from server')
      }
      
      setMessages((prev) => {
        // Remove optimistic message
        const filtered = prev.filter((m) => m.id !== optimisticMessage.id)
        
        // Check if saved message already exists (from Socket.io event)
        const exists = filtered.some((m) => m.id === savedMessage.id)
        if (exists) {
          // Message already added via Socket.io, just return filtered list
          return filtered
        }
        
        // Add saved message if it doesn't exist
        return [...filtered, savedMessage]
      })
    } catch (err: any) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id))

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
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <h2 className="text-xl font-semibold">{roomName}</h2>
        <PresenceBar roomId={roomId} />
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages
          .filter((message) => message.user?.id) // Filter out messages without user.id
          .map((message) => (
            <MessageItem 
              key={message.id} 
              message={message} 
              currentUserId={session.user!.id} 
            />
          ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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