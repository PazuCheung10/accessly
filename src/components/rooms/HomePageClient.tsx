'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RoomCard } from './RoomCard'
import { RoomFilters } from './RoomFilters'
import { CreateRoomButton } from './CreateRoomButton'

interface Room {
  id: string
  name: string
  title: string
  description?: string | null
  tags?: string[]
  type: 'PUBLIC' | 'PRIVATE' | 'DM' | 'TICKET'
  isPrivate: boolean
  _count: {
    members: number
    messages: number
  }
  lastMessage?: {
    id: string
    content: string
    createdAt: string
    user: {
      id: string
      name: string | null
      image: string | null
    }
  } | null
  creator?: {
    id: string
    name: string | null
    image: string | null
  } | null
  role?: string
}

interface HomePageClientProps {
  initialMyRooms: Room[]
  initialDiscoverRooms: Room[]
  initialCursor: string | null
  initialHasMore: boolean
  availableTags: string[]
  initialFilters: {
    q: string
    tag: string
    sort: string
  }
  userRole?: 'USER' | 'ADMIN'
}

export function HomePageClient({
  initialMyRooms,
  initialDiscoverRooms,
  initialCursor,
  initialHasMore,
  availableTags,
  initialFilters,
  userRole = 'USER',
}: HomePageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  const [myRooms, setMyRooms] = useState<Room[]>(initialMyRooms)
  const [discoverRooms, setDiscoverRooms] = useState<Room[]>(initialDiscoverRooms)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const searchParams = new URLSearchParams(window.location.search)
      searchParams.set('cursor', cursor)

      const response = await fetch(`/api/chat/rooms/discover?${searchParams.toString()}`)
      const data = await response.json()

      if (data.ok && data.data?.rooms) {
        setDiscoverRooms((prev) => [...prev, ...data.data.rooms])
        setCursor(data.data.cursor)
        setHasMore(data.data.hasMore)
      }
    } catch (err) {
      console.error('Error loading more rooms:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleFilterChange = (filters: { q: string; tag: string; sort: string }) => {
    startTransition(() => {
      // Reload discover rooms with new filters
      const searchParams = new URLSearchParams()
      if (filters.q) searchParams.set('q', filters.q)
      if (filters.tag) searchParams.set('tag', filters.tag)
      if (filters.sort) searchParams.set('sort', filters.sort)

      fetch(`/api/chat/rooms/discover?${searchParams.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.data?.rooms) {
            setDiscoverRooms(data.data.rooms)
            setCursor(data.data.cursor)
            setHasMore(data.data.hasMore)
          }
        })
        .catch((err) => console.error('Error filtering rooms:', err))
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Forum</h1>
            <p className="text-slate-400 mt-1">Discover and join discussion rooms</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Support CTA - visible for all users */}
            <Link
              href="/support"
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Need help? Contact Support →
            </Link>
            {/* Tickets link - visible only for admins */}
            {userRole === 'ADMIN' && (
              <Link
                href="/tickets"
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                View all tickets →
              </Link>
            )}
            <CreateRoomButton />
          </div>
        </div>

        {/* My Rooms Section */}
        {myRooms.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">My Rooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myRooms.map((room) => (
                <RoomCard key={room.id} room={room} role={room.role} />
              ))}
            </div>
          </section>
        )}

        {/* Discover Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Discover Rooms</h2>
          </div>

          {/* Filters */}
          <RoomFilters
            availableTags={availableTags}
            onFilterChange={handleFilterChange}
          />

          {/* Loading State */}
          {(isPending || isLoadingMore) && (
            <div className="text-center py-8 text-slate-400">
              Loading...
            </div>
          )}

          {/* Rooms Grid */}
          {!isPending && (
            <>
              {discoverRooms.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {discoverRooms.map((room) => (
                      <RoomCard key={room.id} room={room} />
                    ))}
                  </div>

                  {/* Load More Button */}
                  {hasMore && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isLoadingMore ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-lg mb-2">No rooms found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

