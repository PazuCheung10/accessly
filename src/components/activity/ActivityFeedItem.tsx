'use client'

import { ActivityEvent } from '@/lib/activity/types'
import { useRouter } from 'next/navigation'

interface ActivityFeedItemProps {
  event: ActivityEvent
}

function formatTimeAgo(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

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

  return dateObj.toLocaleDateString()
}

function getEventIcon(type: ActivityEvent['type']): string {
  switch (type) {
    case 'ticket.created':
      return '🎫'
    case 'ticket.status.changed':
      return '🔄'
    case 'ticket.assigned':
      return '👤'
    case 'room.created':
      return '💬'
    case 'message.posted':
      return '💭'
    default:
      return '📌'
  }
}

function getEventText(event: ActivityEvent): string {
  const actorName = event.actor.name || event.actor.email || 'Unknown'
  const targetTitle = event.target.title || 'Untitled'

  switch (event.type) {
    case 'ticket.created':
      return `${actorName} created ticket "${targetTitle}"`

    case 'ticket.status.changed': {
      const oldStatus = event.metadata.oldStatus || 'Unknown'
      const newStatus = event.metadata.newStatus || 'Unknown'
      return `${actorName} changed ticket "${targetTitle}" status from ${oldStatus} to ${newStatus}`
    }

    case 'ticket.assigned': {
      const assignedToName = event.metadata.assignedToName || 'Unknown'
      return `${actorName} assigned ticket "${targetTitle}" to ${assignedToName}`
    }

    case 'room.created':
      return `${actorName} created room "${targetTitle}"`

    case 'message.posted': {
      const content = event.metadata.content || ''
      const preview = content.length > 50 ? content.substring(0, 50) + '...' : content
      const isThreadReply = event.metadata.isThreadReply
      return `${actorName} ${isThreadReply ? 'replied' : 'posted'} in "${targetTitle}": "${preview}"`
    }

    default:
      return `${actorName} performed an action`
  }
}

function getEventLink(event: ActivityEvent): string | null {
  switch (event.type) {
    case 'ticket.created':
    case 'ticket.status.changed':
    case 'ticket.assigned':
      return `/chat?room=${event.target.id}`
    case 'room.created':
      return `/chat?room=${event.target.id}`
    case 'message.posted':
      return `/chat?room=${event.target.id}`
    default:
      return null
  }
}

export function ActivityFeedItem({ event }: ActivityFeedItemProps) {
  const router = useRouter()
  const link = getEventLink(event)
  const timeAgo = formatTimeAgo(event.timestamp)

  const handleClick = () => {
    if (link) {
      router.push(link)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`
        flex items-start gap-3 p-4 rounded-lg border border-slate-700/50
        hover:bg-slate-800/50 hover:border-slate-600 transition-colors
        ${link ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {/* Icon */}
      <div className="text-2xl flex-shrink-0">{getEventIcon(event.type)}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-slate-200 flex-1">{getEventText(event)}</p>
          <span className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap">
            {timeAgo}
          </span>
        </div>

        {/* Actor info */}
        <div className="flex items-center gap-2 mt-2">
          {event.actor.image && (
            <img
              src={event.actor.image}
              alt={event.actor.name || 'User'}
              className="w-5 h-5 rounded-full"
            />
          )}
          <span className="text-xs text-slate-400">
            {event.actor.name || event.actor.email || 'Unknown User'}
          </span>
        </div>
      </div>
    </div>
  )
}

