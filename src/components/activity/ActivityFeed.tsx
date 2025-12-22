'use client'

import { useState, useEffect } from 'react'
import { ActivityEvent } from '@/lib/activity/types'
import { ActivityFeedItem } from './ActivityFeedItem'
import { ActivityFeedEmpty } from './ActivityFeedEmpty'

interface ActivityFeedProps {
  initialLimit?: number
  filterTypes?: ActivityEvent['type'][]
}

export function ActivityFeed({ initialLimit = 50, filterTypes }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const fetchEvents = async (loadMore = false) => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('limit', initialLimit.toString())
      if (cursor && loadMore) {
        params.set('cursor', cursor)
      }
      if (filterTypes && filterTypes.length > 0) {
        params.set('types', filterTypes.join(','))
      }

      const response = await fetch(`/api/activity/feed?${params.toString()}`)
      const data = await response.json()

      if (!data.ok) {
        throw new Error(data.message || 'Failed to fetch activity feed')
      }

      if (loadMore) {
        setEvents((prev) => [...prev, ...data.data.events])
      } else {
        setEvents(data.data.events)
      }

      setCursor(data.data.cursor)
      setHasMore(data.data.hasMore)
    } catch (err: any) {
      setError(err.message || 'Failed to load activity feed')
      console.error('Error fetching activity feed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTypes?.join(',')]) // Re-fetch if filter types change

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      fetchEvents(true)
    }
  }

  if (isLoading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading activity feed...</div>
      </div>
    )
  }

  if (error && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-red-400 mb-2">⚠️</div>
        <p className="text-sm text-slate-400">{error}</p>
        <button
          onClick={() => fetchEvents(false)}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (events.length === 0) {
    return <ActivityFeedEmpty />
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <ActivityFeedItem key={event.id} event={event} />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-slate-200 transition-colors"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}

