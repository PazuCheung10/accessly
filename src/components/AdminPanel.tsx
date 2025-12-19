'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface User {
  id: string
  email: string | null
  name: string | null
  role: string
  createdAt: string
  ban?: {
    reason: string | null
    bannedAt: string
    expiresAt: string | null
  } | null
  _count: {
    messages: number
    memberships: number
  }
}

interface Room {
  id: string
  name: string
  title: string
  type: string
  isPrivate: boolean
  createdAt: string
  _count: {
    members: number
    messages: number
  }
}

export function AdminPanel() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [banningUserId, setBanningUserId] = useState<string | null>(null)
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null)
  const [showBanModal, setShowBanModal] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [usersRes, roomsRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/chat/rooms', { credentials: 'include' }),
      ])

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.data?.users || [])
      }

      if (roomsRes.ok) {
        const roomsData = await roomsRes.json()
        setRooms(roomsData.data?.rooms || [])
      }
    } catch (err) {
      console.error('Error fetching admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBan = async (userId: string) => {
    setSelectedUserId(userId)
    setShowBanModal(true)
  }

  const confirmBan = async () => {
    if (!selectedUserId) return

    try {
      setBanningUserId(selectedUserId)
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: selectedUserId,
          reason: banReason || undefined,
        }),
      })

      const data = await response.json()
      if (data.ok) {
        await fetchData()
        setShowBanModal(false)
        setBanReason('')
        setSelectedUserId(null)
      } else {
        alert(data.message || 'Failed to ban user')
      }
    } catch (err) {
      console.error('Error banning user:', err)
      alert('Failed to ban user')
    } finally {
      setBanningUserId(null)
    }
  }

  const handleUnban = async (userId: string) => {
    if (!confirm('Unban this user?')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()
      if (data.ok) {
        await fetchData()
      } else {
        alert(data.message || 'Failed to unban user')
      }
    } catch (err) {
      console.error('Error unbanning user:', err)
      alert('Failed to unban user')
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) return

    try {
      setDeletingRoomId(roomId)
      const response = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: true }),
      })

      const data = await response.json()
      if (data.ok) {
        await fetchData()
      } else {
        alert(data.message || 'Failed to delete room')
      }
    } catch (err) {
      console.error('Error deleting room:', err)
      alert('Failed to delete room')
    } finally {
      setDeletingRoomId(null)
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Users List */}
      <div className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">All Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-4 text-slate-400">Email</th>
                <th className="text-left py-2 px-4 text-slate-400">Name</th>
                <th className="text-left py-2 px-4 text-slate-400">Role</th>
                <th className="text-left py-2 px-4 text-slate-400">Status</th>
                <th className="text-left py-2 px-4 text-slate-400">Messages</th>
                <th className="text-left py-2 px-4 text-slate-400">Rooms</th>
                <th className="text-left py-2 px-4 text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-800/50">
                  <td className="py-2 px-4">{user.email || 'N/A'}</td>
                  <td className="py-2 px-4">{user.name || 'N/A'}</td>
                  <td className="py-2 px-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-slate-700/50 text-slate-300'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    {user.ban ? (
                      <span className="px-2 py-1 text-xs bg-red-500/20 text-red-300 border border-red-500/30 rounded">
                        Banned
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-green-500/20 text-green-300 border border-green-500/30 rounded">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4">{user._count?.messages ?? 0}</td>
                  <td className="py-2 px-4">{user._count?.memberships ?? 0}</td>
                  <td className="py-2 px-4">
                    <div className="flex gap-2">
                      {user.ban ? (
                        <button
                          onClick={() => handleUnban(user.id)}
                          className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded"
                          disabled={user.id === session?.user?.id}
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBan(user.id)}
                          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                          disabled={user.id === session?.user?.id || user.role === 'ADMIN'}
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rooms List */}
      <div className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">All Rooms</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-4 text-slate-400">Name</th>
                <th className="text-left py-2 px-4 text-slate-400">Type</th>
                <th className="text-left py-2 px-4 text-slate-400">Members</th>
                <th className="text-left py-2 px-4 text-slate-400">Messages</th>
                <th className="text-left py-2 px-4 text-slate-400">Created</th>
                <th className="text-left py-2 px-4 text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b border-slate-800/50">
                  <td className="py-2 px-4">{room.name}</td>
                  <td className="py-2 px-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        room.isPrivate
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-green-500/20 text-green-300 border border-green-500/30'
                      }`}
                    >
                      {room.isPrivate ? 'Private' : 'Public'}
                    </span>
                  </td>
                  <td className="py-2 px-4">{room._count.members}</td>
                  <td className="py-2 px-4">{room._count.messages}</td>
                  <td className="py-2 px-4 text-sm text-slate-400">
                    {new Date(room.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      disabled={deletingRoomId === room.id}
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                    >
                      {deletingRoomId === room.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Ban User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Reason (optional)</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  rows={3}
                  placeholder="Enter ban reason..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowBanModal(false)
                    setBanReason('')
                    setSelectedUserId(null)
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBan}
                  disabled={banningUserId !== null}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                >
                  {banningUserId ? 'Banning...' : 'Ban User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

