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
  createdAt: string | Date
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
  role?: string | null
}

interface HomePageClientProps {
  initialRooms: Room[]
  availableTags: string[]
  initialFilters: {
    q: string
    tag: string
    sort: string
  }
  userRole?: 'USER' | 'ADMIN'
}

export function HomePageClient({
  initialRooms,
  availableTags,
  initialFilters,
  userRole = 'USER',
}: HomePageClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  const [allRooms] = useState<Room[]>(initialRooms)
  const [filters, setFilters] = useState(initialFilters)

  // Client-side filtering
  const filteredRooms = allRooms.filter((room) => {
    // Search filter
    if (filters.q) {
      const query = filters.q.toLowerCase()
      const matchesSearch =
        room.title.toLowerCase().includes(query) ||
        room.name.toLowerCase().includes(query) ||
        (room.description && room.description.toLowerCase().includes(query))
      if (!matchesSearch) return false
    }

    // Tag filter
    if (filters.tag && room.tags) {
      if (!room.tags.includes(filters.tag)) return false
    }

    return true
  })

  // Compute available tags based on filtered rooms (when a tag is selected, only show tags that co-occur with it)
  const availableTagsForFilter = filters.tag
    ? [filters.tag, ...Array.from(
        new Set(
          filteredRooms
            .flatMap((r) => r.tags || [])
            .filter((t) => t.length > 0 && t !== filters.tag)
        )
      )].sort()
    : availableTags

  // Sort rooms
  const sortedRooms = [...filteredRooms].sort((a, b) => {
    switch (filters.sort) {
      case 'new':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'members':
        return (b._count.members || 0) - (a._count.members || 0)
      case 'active':
      default:
        return (b._count.messages || 0) - (a._count.messages || 0)
    }
  })

  const handleFilterChange = (newFilters: { q: string; tag: string; sort: string }) => {
    startTransition(() => {
      setFilters(newFilters)
      // Update URL without reloading
      const searchParams = new URLSearchParams()
      if (newFilters.q) searchParams.set('q', newFilters.q)
      if (newFilters.tag) searchParams.set('tag', newFilters.tag)
      if (newFilters.sort) searchParams.set('sort', newFilters.sort)
      router.push(`/?${searchParams.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Workspace</h1>
            <p className="text-slate-400 mt-1">Enterprise collaboration platform</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Support CTA removed - internal employees don't need it */}
            {/* Tickets link - visible only for admins */}
            {userRole === 'ADMIN' && (
              <Link
                href="/tickets"
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                View all issues →
              </Link>
            )}
            <CreateRoomButton />
          </div>
        </div>

        {/* Rooms Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Rooms</h2>
          </div>

          {/* Filters */}
          <RoomFilters
            availableTags={availableTagsForFilter}
            onFilterChange={handleFilterChange}
          />

          {/* Loading State */}
          {isPending && (
            <div className="text-center py-8 text-slate-400">
              Loading...
            </div>
          )}

          {/* Rooms Grid */}
          {!isPending && (
            <>
              {sortedRooms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedRooms.map((room) => (
                    <RoomCard key={room.id} room={room} role={room.role ?? undefined} />
                  ))}
                </div>
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

