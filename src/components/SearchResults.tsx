'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SearchBar } from './SearchBar'
import Link from 'next/link'

interface SearchResult {
  id: string
  roomId: string
  roomTitle: string
  content: string
  snippet: string
  parentMessageId: string | null
  parentContext: {
    id: string
    content: string
    user: {
      id: string
      name: string | null
      email: string | null
    }
  } | null
  createdAt: string
  score: number
  user: {
    id: string
    name: string | null
    email: string | null
  }
}

interface RoomResult {
  id: string
  title: string
  description: string | null
  type: string
  score: number
}

interface SearchResultsProps {
  initialQuery?: string
  initialRoomId?: string | null
}

export function SearchResults({ initialQuery = '', initialRoomId = null }: SearchResultsProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [isSearching, setIsSearching] = useState(false)
  const [messages, setMessages] = useState<SearchResult[]>([])
  const [rooms, setRooms] = useState<RoomResult[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery)
    }
  }, [initialQuery])

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setMessages([])
      setRooms([])
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: searchQuery,
          roomId: initialRoomId,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Search failed')
      }

      setMessages(data.data?.messages || [])
      setRooms(data.data?.rooms || [])
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.message || 'Failed to search')
      setMessages([])
      setRooms([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)
    router.push(`/search?q=${encodeURIComponent(searchQuery)}${initialRoomId ? `&roomId=${initialRoomId}` : ''}`)
    performSearch(searchQuery)
  }

  const handleResultClick = (result: SearchResult) => {
    // Navigate to chat room with thread deep-link
    // If it's a reply, link to parent thread; otherwise link to the message itself
    const threadId = result.parentMessageId || result.id
    const url = `/chat?room=${result.roomId}&thread=${threadId}`
    router.push(url)
  }

  return (
    <div>
      <div className="mb-6">
        <SearchBar
          placeholder="Search messages and rooms... (e.g., 'from:@alice tag:billing before:2024-01-01')"
          onSearch={handleSearch}
        />
        {query && (
          <div className="mt-2 text-sm text-slate-400">
            Searching for: <span className="font-medium text-slate-300">{query}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 mb-6">
          {error}
        </div>
      )}

      {isSearching && (
        <div className="text-center py-8 text-slate-400">
          Searching...
        </div>
      )}

      {!isSearching && query && messages.length === 0 && rooms.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          No results found
        </div>
      )}

      {/* Room Results */}
      {rooms.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Rooms</h2>
          <div className="space-y-3">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/chat?room=${room.id}`}
                className="block bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{room.title}</h3>
                    {room.description && (
                      <p className="text-sm text-slate-400 mb-2">{room.description}</p>
                    )}
                    <span className="text-xs px-2 py-1 bg-slate-700 rounded">{room.type}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Score: {room.score.toFixed(2)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Message Results */}
      {messages.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Messages</h2>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                onClick={() => handleResultClick(message)}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-300">
                        {message.user.name || message.user.email}
                      </span>
                      <span className="text-xs text-slate-500">in</span>
                      <Link
                        href={`/chat?room=${message.roomId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-cyan-400 hover:text-cyan-300"
                      >
                        {message.roomTitle}
                      </Link>
                    </div>
                    {message.parentContext && (
                      <div className="ml-4 pl-4 border-l-2 border-slate-700 mb-2 text-sm text-slate-400">
                        <div className="text-xs mb-1">In reply to:</div>
                        <div className="line-clamp-2">
                          {message.parentContext.user.name || message.parentContext.user.email}: {message.parentContext.content.slice(0, 100)}
                          {message.parentContext.content.length > 100 ? '...' : ''}
                        </div>
                      </div>
                    )}
                    <div 
                      className="text-sm text-slate-300"
                      dangerouslySetInnerHTML={{ 
                        __html: message.snippet.replace(
                          new RegExp(`(${query.split(/\s+/).filter(w => w.length > 0).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'),
                          '<mark class="bg-yellow-500/30 text-yellow-200">$1</mark>'
                        )
                      }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 ml-4">
                    <div>Score: {message.score.toFixed(2)}</div>
                    <div className="mt-1">{new Date(message.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

