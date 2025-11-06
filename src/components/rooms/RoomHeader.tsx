'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { RoomRole } from '@prisma/client'

interface RoomHeaderProps {
  roomId: string
  roomName: string
}

interface RoomDetails {
  id: string
  name: string
  title: string
  description: string | null
  tags: string[]
  type: 'PUBLIC' | 'PRIVATE' | 'DM'
  isPrivate: boolean
  userRole: RoomRole | null
  isMember: boolean
  creator: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  _count: {
    members: number
    messages: number
  }
}

export function RoomHeader({ roomId, roomName }: RoomHeaderProps) {
  const { data: session } = useSession()
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showMembers, setShowMembers] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    tags: '',
  })
  const [inviteEmail, setInviteEmail] = useState('')

  useEffect(() => {
    fetchRoomDetails()
  }, [roomId])

  const fetchRoomDetails = async () => {
    try {
      const response = await fetch(`/api/chat/rooms/${roomId}`)
      const data = await response.json()
      if (data.ok && data.data?.room) {
        const room = data.data.room
        setRoomDetails(room)
        setEditForm({
          title: room.title,
          description: room.description || '',
          tags: room.tags?.join(', ') || '',
        })
      }
    } catch (err) {
      console.error('Error fetching room details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const tags = editForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const response = await fetch(`/api/chat/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          tags,
        }),
      })

      const data = await response.json()
      if (data.ok) {
        setIsEditing(false)
        fetchRoomDetails()
      } else {
        alert(data.message || 'Failed to update room')
      }
    } catch (err) {
      console.error('Error updating room:', err)
      alert('Failed to update room')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // First, find user by email
      const userResponse = await fetch(`/api/users/search?email=${encodeURIComponent(inviteEmail)}`)
      const userData = await userResponse.json()

      if (!userData.ok || !userData.user) {
        alert('User not found')
        return
      }

      const response = await fetch(`/api/chat/rooms/${roomId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.user.id,
          role: 'MEMBER',
        }),
      })

      const data = await response.json()
      if (data.ok) {
        setInviteEmail('')
        setShowInvite(false)
        alert('User invited successfully')
        fetchRoomDetails()
      } else {
        alert(data.message || 'Failed to invite user')
      }
    } catch (err) {
      console.error('Error inviting user:', err)
      alert('Failed to invite user')
    }
  }

  if (isLoading || !roomDetails) {
    return (
      <div className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <div className="text-slate-400">Loading room details...</div>
      </div>
    )
  }

  const visibilityBadge = roomDetails.type === 'PUBLIC'
    ? { label: 'Public', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
    : roomDetails.type === 'PRIVATE'
    ? { label: 'Private', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
    : { label: 'DM', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }

  const canEdit = roomDetails.userRole === RoomRole.OWNER
  const canInvite = roomDetails.userRole === RoomRole.OWNER || roomDetails.userRole === RoomRole.MODERATOR

  return (
    <div className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Room title"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white mb-2"
                required
              />
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Room description"
                rows={2}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white mb-2"
              />
              <input
                type="text"
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                placeholder="Tags (comma-separated)"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white mb-2"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-sm"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-1">{roomDetails.title || roomName}</h2>
              {roomDetails.description && (
                <p className="text-sm text-slate-400 mb-2">{roomDetails.description}</p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
              title="Edit room"
            >
              ✏️
            </button>
          )}
          {canInvite && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
              title="Invite member"
            >
              ➕
            </button>
          )}
          <button
            onClick={() => {
              console.log('Members button clicked, toggling showMembers:', !showMembers)
              setShowMembers(!showMembers)
            }}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
            title="View members"
          >
            👥 {roomDetails._count.members}
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`px-2 py-1 text-xs font-semibold rounded border ${visibilityBadge.color}`}>
          {visibilityBadge.label}
        </span>
        {roomDetails.tags && roomDetails.tags.length > 0 && (
          <>
            {roomDetails.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-slate-700/50 text-slate-300 rounded"
              >
                #{tag}
              </span>
            ))}
          </>
        )}
        {roomDetails.userRole && (
          <span className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded">
            {roomDetails.userRole}
          </span>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Invite User</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  User Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowInvite(false)
                    setInviteEmail('')
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded"
                >
                  Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembers && (
        <MembersList
          roomId={roomId}
          userRole={roomDetails.userRole}
          onClose={() => {
            console.log('Closing members modal')
            setShowMembers(false)
          }}
          onMemberRemoved={fetchRoomDetails}
        />
      )}
    </div>
  )
}

function MembersList({
  roomId,
  userRole,
  onClose,
  onMemberRemoved,
}: {
  roomId: string
  userRole: RoomRole | null
  onClose: () => void
  onMemberRemoved: () => void
}) {
  const [members, setMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('Fetching members for room:', roomId)
      const response = await fetch(`/api/chat/rooms/${roomId}/members`)
      const data = await response.json()
      
      console.log('Members API response:', { ok: data.ok, status: response.status, data })
      
      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Failed to fetch members')
      }
      
      if (data.data?.members) {
        console.log('Setting members:', data.data.members.length, 'members')
        setMembers(data.data.members)
      } else {
        console.warn('No members in response data')
        setMembers([])
      }
    } catch (err: any) {
      console.error('Error fetching members:', err)
      setError(err.message || 'Failed to load members')
      setMembers([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member?')) return

    try {
      const response = await fetch(`/api/chat/rooms/${roomId}/members?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.ok) {
        fetchMembers()
        onMemberRemoved()
      } else {
        alert(data.message || 'Failed to remove member')
      }
    } catch (err) {
      console.error('Error removing member:', err)
      alert('Failed to remove member')
    }
  }

  const canRemove = userRole === RoomRole.OWNER || userRole === RoomRole.MODERATOR

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Room Members</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        {isLoading ? (
          <div className="text-slate-400">Loading...</div>
        ) : error ? (
          <div className="text-red-400">
            <p className="mb-2">{error}</p>
            <button
              onClick={fetchMembers}
              className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
            >
              Retry
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="text-slate-400">No members found</div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-slate-900 rounded"
              >
                <div>
                  <div className="font-medium">{member.user.name || member.user.email}</div>
                  <div className="text-xs text-slate-400">{member.user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-slate-700 rounded">{member.role}</span>
                  {canRemove && member.role !== RoomRole.OWNER && (
                    <button
                      onClick={() => handleRemoveMember(member.user.id)}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

