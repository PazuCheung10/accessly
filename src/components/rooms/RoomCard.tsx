'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

interface RoomCardProps {
  room: {
    id: string
    name: string
    title: string
    description?: string | null
    tags?: string[]
    type: 'PUBLIC' | 'PRIVATE' | 'DM'
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
  }
  role?: string
}

export function RoomCard({ room, role }: RoomCardProps) {
  const router = useRouter()
  
  const lastMessageTime = room.lastMessage
    ? formatDistanceToNow(new Date(room.lastMessage.createdAt), { addSuffix: true })
    : null

  const lastMessageSnippet = room.lastMessage
    ? room.lastMessage.content.length > 100
      ? room.lastMessage.content.slice(0, 100) + '...'
      : room.lastMessage.content
    : 'No messages yet'

  const visibilityBadge = room.type === 'PUBLIC' 
    ? { label: 'Public', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
    : room.type === 'PRIVATE'
    ? { label: 'Private', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
    : { label: 'DM', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }

  const handleClick = () => {
    router.push(`/chat?room=${room.id}`)
  }

  return (
    <div
      onClick={handleClick}
      className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800 hover:border-slate-600 transition-all cursor-pointer"
    >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white mb-1 truncate">
              {room.title}
            </h3>
            <p className="text-sm text-slate-400 truncate">
              {room.description || 'No description'}
            </p>
          </div>
          <span className={`px-2 py-1 text-xs font-semibold rounded border ${visibilityBadge.color} flex-shrink-0 ml-2`}>
            {visibilityBadge.label}
          </span>
        </div>

        {/* Tags */}
        {room.tags && room.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {room.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-slate-700/50 text-slate-300 rounded"
              >
                #{tag}
              </span>
            ))}
            {room.tags.length > 3 && (
              <span className="px-2 py-1 text-xs text-slate-500">
                +{room.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Last Message */}
        {room.lastMessage && (
          <div className="mb-3 p-3 bg-slate-900/50 rounded border border-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-slate-300">
                {room.lastMessage.user?.name || 'Anonymous'}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-500">
                {lastMessageTime}
              </span>
            </div>
            <p className="text-sm text-slate-400 line-clamp-2">
              {lastMessageSnippet}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              👥 {room._count.members} {room._count.members === 1 ? 'member' : 'members'}
            </span>
            <span>
              💬 {room._count.messages} {room._count.messages === 1 ? 'message' : 'messages'}
            </span>
          </div>
          {role && (
            <span className="text-xs px-2 py-1 bg-slate-700/50 rounded">
              {role}
            </span>
          )}
        </div>
    </div>
  )
}

