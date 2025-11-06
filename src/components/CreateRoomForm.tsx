'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateRoomForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.startsWith('#') ? name : `#${name}`,
          isPrivate,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Failed to create room')
      }

      // Reset form
      setName('')
      setIsPrivate(false)
      
      // Navigate to the newly created room if we have an ID
      // Otherwise, just close - room will appear in list on next navigation
      if (data.data?.room?.id) {
        router.push(`/chat?room=${data.data.room.id}`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create room')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="room-name" className="block text-sm font-medium text-slate-300 mb-2">
          Room Name
        </label>
        <input
          id="room-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="#general (will add # automatically)"
          required
          pattern="[a-zA-Z0-9_-]+"
          className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <p className="mt-1 text-xs text-slate-400">
          Room name should be alphanumeric (e.g., "general" or "#general")
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="room-private"
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-400"
        />
        <label htmlFor="room-private" className="text-sm text-slate-300">
          Private room
        </label>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !name.trim()}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        {isLoading ? 'Creating...' : 'Create Room'}
      </button>
    </form>
  )
}

