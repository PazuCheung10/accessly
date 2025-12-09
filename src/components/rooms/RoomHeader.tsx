'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  type: 'PUBLIC' | 'PRIVATE' | 'DM' | 'TICKET'
  status: 'OPEN' | 'WAITING' | 'RESOLVED' | null
  ticketDepartment: 'IT_SUPPORT' | 'BILLING' | 'PRODUCT' | 'GENERAL' | null
  isPrivate: boolean
  userRole: RoomRole | null
  isMember: boolean
  creator: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  owner: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
  lastResponder: {
    id: string
    name: string | null
    email: string
  } | null
  averageResponseTime: number | null
  _count: {
    members: number
    messages: number
  }
}

export function RoomHeader({ roomId, roomName }: RoomHeaderProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showMembers, setShowMembers] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    tags: '',
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [assignToUserId, setAssignToUserId] = useState('')
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  useEffect(() => {
    fetchRoomDetails()
  }, [roomId])

  useEffect(() => {
    if (showAssign) {
      fetchAdminUsers()
    }
  }, [showAssign])

  const fetchAdminUsers = async () => {
    try {
      const response = await fetch('/api/admin/users?role=ADMIN')
      const data = await response.json()
      if (data.ok && data.data?.users) {
        setAdminUsers(data.data.users)
      }
    } catch (err) {
      console.error('Error fetching admin users:', err)
    }
  }

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

      // Use settings endpoint for tags/type if user is mod/owner
      const canEditSettings = roomDetails?.userRole === RoomRole.OWNER || roomDetails?.userRole === RoomRole.MODERATOR
      
      if (canEditSettings) {
        // Update via settings endpoint (for tags/type)
        const settingsResponse = await fetch(`/api/chat/rooms/${roomId}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tags }),
        })
        
        if (!settingsResponse.ok) {
          const settingsData = await settingsResponse.json()
          throw new Error(settingsData.message || 'Failed to update settings')
        }
      }

      // Update title/description via main room endpoint
      const response = await fetch(`/api/chat/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
        }),
      })

      const data = await response.json()
      if (data.ok) {
        setIsEditing(false)
        fetchRoomDetails()
      } else {
        alert(data.message || 'Failed to update room')
      }
    } catch (err: any) {
      console.error('Error updating room:', err)
      alert(err.message || 'Failed to update room')
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

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignToUserId) return

    setIsAssigning(true)
    try {
      const response = await fetch(`/api/tickets/${roomId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignToUserId }),
      })

      const data = await response.json()
      if (data.ok) {
        setAssignToUserId('')
        setShowAssign(false)
        alert('Ticket assigned successfully')
        fetchRoomDetails()
      } else {
        alert(data.message || 'Failed to assign ticket')
      }
    } catch (err) {
      console.error('Error assigning ticket:', err)
      alert('Failed to assign ticket')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleStatusChange = async (newStatus: 'OPEN' | 'WAITING' | 'RESOLVED') => {
    if (!roomId || roomDetails?.status === newStatus) return

    setIsUpdatingStatus(true)
    try {
      const response = await fetch(`/api/tickets/${roomId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()
      if (data.ok) {
        // Update local state immediately without refetch
        setRoomDetails((prev) => {
          if (!prev) return prev
          return { ...prev, status: newStatus }
        })
      } else {
        alert(data.message || 'Failed to update ticket status')
      }
    } catch (err) {
      console.error('Error updating ticket status:', err)
      alert('Failed to update ticket status')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleExport = async () => {
    const format = prompt('Export format: json, html, or pdf?', 'json')
    if (!format || !['json', 'html', 'pdf'].includes(format.toLowerCase())) {
      return
    }

    try {
      const response = await fetch(`/api/export?roomId=${roomId}&format=${format.toLowerCase()}`)
      
      if (!response.ok) {
        const data = await response.json()
        alert(data.message || 'Failed to export room')
        return
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `room-${roomId}-${Date.now()}.${format}`

      // Download file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting room:', err)
      alert('Failed to export room')
    }
  }

  // Clean title by removing department prefix like [TICKET][Security] or [Security]
  const cleanTitle = (title: string | null) => {
    if (!title) return ''
    // Remove [TICKET][Department] or [Department] prefix
    return title.replace(/^\[TICKET\]\[[^\]]+\]\s*/, '').replace(/^\[TICKET\]\s*/, '').replace(/^\[[^\]]+\]\s*/, '').trim()
  }

  // For DM rooms, show other user's name/email; otherwise use room name/title
  // For TICKET rooms, clean the title to remove department prefix
  const displayName = roomDetails?.type === 'DM' && roomDetails?.otherUser
    ? (roomDetails.otherUser.name || roomDetails.otherUser.email || roomName)
    : roomDetails?.type === 'TICKET'
    ? (cleanTitle(roomDetails?.title || '') || roomDetails?.name || roomName || 'Room')
    : (roomDetails?.title || roomDetails?.name || roomName || 'Room')

  const visibilityBadge = roomDetails?.type === 'PUBLIC'
    ? { label: 'Public', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
    : roomDetails?.type === 'PRIVATE'
    ? { label: 'Private', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
    : roomDetails?.type === 'TICKET'
    ? { label: 'Ticket', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
    : { label: 'DM', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }

  const statusBadge = roomDetails?.status === 'OPEN'
    ? { label: 'OPEN', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
    : roomDetails?.status === 'WAITING'
    ? { label: 'WAITING', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
    : roomDetails?.status === 'RESOLVED'
    ? { label: 'RESOLVED', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
    : null

  const canEdit = roomDetails?.type !== 'DM' && roomDetails?.userRole === RoomRole.OWNER
  // DM rooms cannot have invites (only 2 members)
  const canInvite = roomDetails?.type !== 'DM' && roomDetails?.type !== 'TICKET' && (roomDetails?.userRole === RoomRole.OWNER || roomDetails?.userRole === RoomRole.MODERATOR)
  const canAssign = roomDetails?.type === 'TICKET' && roomDetails?.userRole === RoomRole.OWNER
  // Admin can change ticket status
  const canChangeStatus = roomDetails?.type === 'TICKET' && session?.user?.role === 'ADMIN'

  const getDepartmentLabel = (department: string | null) => {
    if (!department) return 'General'
    switch (department) {
      case 'IT_SUPPORT':
        return 'IT Support'
      case 'BILLING':
        return 'Billing'
      case 'PRODUCT':
        return 'Product'
      case 'GENERAL':
        return 'General'
      default:
        return department
    }
  }

  const getDepartmentColor = (department: string | null) => {
    switch (department) {
      case 'IT_SUPPORT':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'BILLING':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'PRODUCT':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'GENERAL':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

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
              <div className="flex items-center gap-3 mb-1">
                {roomDetails?.type === 'DM' && roomDetails?.otherUser?.image && (
                  <img
                    src={roomDetails.otherUser.image}
                    alt={displayName}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <h2 className="text-xl font-semibold flex-1">{displayName}</h2>
                {roomDetails?.type === 'TICKET' && (
                  <Link
                    href="/tickets"
                    className="text-sm text-cyan-400 hover:text-cyan-300 underline whitespace-nowrap"
                  >
                    ← Back to tickets
                  </Link>
                )}
              </div>
              {roomDetails?.type === 'DM' && roomDetails?.otherUser?.email && (
                <p className="text-sm text-slate-400 mb-2">{roomDetails.otherUser.email}</p>
              )}
              {roomDetails?.type !== 'DM' && roomDetails?.description && (
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
          {canAssign && (
            <button
              onClick={() => setShowAssign(!showAssign)}
              className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 rounded"
              title="Assign ticket"
            >
              👤 Assign
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
            onClick={handleExport}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
            title="Export room"
          >
            📥 Export
          </button>
          <button
            onClick={() => {
              console.log('Members button clicked, toggling showMembers:', !showMembers)
              setShowMembers(!showMembers)
            }}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded"
            title="View members"
          >
            👥 {roomDetails?._count?.members ?? 0}
          </button>
        </div>
      </div>

      {/* Badges and Info */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`px-2 py-1 text-xs font-semibold rounded border ${visibilityBadge.color}`}>
          {visibilityBadge.label}
        </span>
        {roomDetails?.type === 'TICKET' && roomDetails?.ticketDepartment && (
          <span
            className={`px-2 py-1 text-xs font-semibold rounded border ${getDepartmentColor(roomDetails.ticketDepartment)}`}
          >
            {getDepartmentLabel(roomDetails.ticketDepartment)}
          </span>
        )}
        {roomDetails?.type === 'TICKET' && canChangeStatus ? (
          /* Status dropdown for admins */
          <select
            value={roomDetails.status || 'OPEN'}
            onChange={(e) => handleStatusChange(e.target.value as 'OPEN' | 'WAITING' | 'RESOLVED')}
            disabled={isUpdatingStatus}
            className={`px-2 py-1 text-xs font-semibold rounded border ${
              statusBadge?.color || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
            } bg-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <option value="OPEN">OPEN</option>
            <option value="WAITING">WAITING</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        ) : statusBadge ? (
          /* Read-only status badge for non-admins */
          <span className={`px-2 py-1 text-xs font-semibold rounded border ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        ) : null}
        {roomDetails?.tags && roomDetails.tags.length > 0 && (
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
        {roomDetails?.userRole && (
          <span className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded">
            {roomDetails.userRole}
          </span>
        )}
      </div>

      {/* Ticket-specific info */}
      {roomDetails?.type === 'TICKET' && (
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-sm">
          {roomDetails?.ticketDepartment && (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="font-medium text-slate-300">Department:</span>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded border ${getDepartmentColor(roomDetails.ticketDepartment)}`}
              >
                {getDepartmentLabel(roomDetails.ticketDepartment)}
              </span>
            </div>
          )}
          {roomDetails?.owner && (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="font-medium text-slate-300">Assigned to:</span>
              <span>{roomDetails.owner.name || roomDetails.owner.email}</span>
            </div>
          )}
          {roomDetails?.lastResponder && (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="font-medium text-slate-300">Last responder:</span>
              <span>{roomDetails.lastResponder.name || roomDetails.lastResponder.email}</span>
            </div>
          )}
          {roomDetails?.averageResponseTime !== null && (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="font-medium text-slate-300">Avg response time:</span>
              <span>{roomDetails.averageResponseTime} minutes</span>
            </div>
          )}
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Assign Ticket</h3>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Assign to Admin
                </label>
                <select
                  value={assignToUserId}
                  onChange={(e) => setAssignToUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                  required
                >
                  <option value="">Select an admin...</option>
                  {adminUsers.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name || admin.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssign(false)
                    setAssignToUserId('')
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
                  disabled={isAssigning}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
                  disabled={isAssigning || !assignToUserId}
                >
                  {isAssigning ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          userRole={roomDetails?.userRole ?? null}
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
  const { data: session } = useSession()
  const router = useRouter()
  const [members, setMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null)

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
    if (!confirm('Remove this member from the room?')) return

    try {
      const response = await fetch(`/api/chat/rooms/${roomId}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
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

  const handleTransferOwnership = async (userId: string) => {
    if (!confirm('Transfer room ownership? You will become a moderator.')) return

    try {
      const response = await fetch(`/api/chat/rooms/${roomId}/ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newOwnerId: userId }),
      })

      const data = await response.json()
      if (data.ok) {
        fetchMembers()
        onMemberRemoved() // Refresh room details
        alert('Ownership transferred successfully')
      } else {
        alert(data.message || 'Failed to transfer ownership')
      }
    } catch (err) {
      console.error('Error transferring ownership:', err)
      alert('Failed to transfer ownership')
    }
  }

  const canRemove = userRole === RoomRole.OWNER || userRole === RoomRole.MODERATOR
  const canTransferOwnership = userRole === RoomRole.OWNER

  const handleMessageUser = async (userId: string) => {
    if (!session?.user?.email) {
      alert('Please sign in to message users')
      return
    }

    // Prevent messaging yourself (use currentUserId from DB)
    if (currentUserId && currentUserId === userId) {
      alert('Cannot message yourself')
      return
    }

    try {
      setMessagingUserId(userId)
      const response = await fetch(`/api/chat/dm/${userId}`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Failed to create DM')
      }

      // Navigate to the DM room
      if (data.data?.room?.id) {
        onClose() // Close members modal
        router.push(`/chat?room=${data.data.room.id}`)
      }
    } catch (err: any) {
      console.error('Error creating DM:', err)
      alert(err.message || 'Failed to start conversation')
    } finally {
      setMessagingUserId(null)
    }
  }

  // Get current user ID from session (need to fetch from DB to match)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.email) {
      // Fetch DB user ID to match member IDs
      fetch('/api/debug/session')
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.dbUser?.id) {
            setCurrentUserId(data.dbUser.id)
          }
        })
        .catch((err) => console.error('Failed to fetch current user ID:', err))
    }
  }, [session?.user?.email])

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
            {members.map((member) => {
              const isCurrentUser = currentUserId && member.user.id === currentUserId
              return (
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
                    {/* DM feature disabled - message button removed */}
                    {canTransferOwnership && member.role !== RoomRole.OWNER && !isCurrentUser && (
                      <button
                        onClick={() => handleTransferOwnership(member.user.id)}
                        className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 rounded"
                        title="Transfer ownership"
                      >
                        Make Owner
                      </button>
                    )}
                    {canRemove && member.role !== RoomRole.OWNER && !isCurrentUser && (
                      <button
                        onClick={() => handleRemoveMember(member.user.id)}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                        title="Remove member"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

