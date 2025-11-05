'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ChatRoom } from '@/components/ChatRoom'

interface Room {
  id: string
  name: string
  isPrivate: boolean
  _count?: {
    members: number
    messages: number
  }
}

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string>('General')
  const [myRooms, setMyRooms] = useState<Room[]>([])
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showRoomSelector, setShowRoomSelector] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in?callbackUrl=/chat')
    }
  }, [status, router])

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setIsLoading(true)
        // Fetch rooms user is a member of
        const myRoomsResponse = await fetch('/api/chat/rooms')
        if (myRoomsResponse.ok) {
          const myRoomsData = await myRoomsResponse.json()
          if (myRoomsData.ok && myRoomsData.data?.rooms) {
            setMyRooms(myRoomsData.data.rooms)
            // Auto-select first room if no room selected
            if (!roomId && myRoomsData.data.rooms.length > 0) {
              const firstRoom = myRoomsData.data.rooms[0]
              setRoomId(firstRoom.id)
              setRoomName(firstRoom.name)
            }
          }
        }

        // Fetch available rooms to join
        const availableResponse = await fetch('/api/chat/rooms/available')
        if (availableResponse.ok) {
          const availableData = await availableResponse.json()
          if (availableData.ok && availableData.data?.rooms) {
            setAvailableRooms(availableData.data.rooms)
          }
        }
      } catch (err) {
        console.error('Error fetching rooms:', err)
      } finally {
        setIsLoading(false)
      }
    }
    
    if (session?.user) {
      fetchRooms()
    }
  }, [session, roomId])

  const handleJoinRoom = async (room: Room) => {
    try {
      const response = await fetch(`/api/chat/rooms/${room.id}/join`, {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok && data.ok) {
        // Refresh rooms list
        const myRoomsResponse = await fetch('/api/chat/rooms')
        if (myRoomsResponse.ok) {
          const myRoomsData = await myRoomsResponse.json()
          if (myRoomsData.ok && myRoomsData.data?.rooms) {
            setMyRooms(myRoomsData.data.rooms)
            // Switch to the newly joined room
            setRoomId(room.id)
            setRoomName(room.name)
            setShowRoomSelector(false)
          }
        }
        // Refresh available rooms
        const availableResponse = await fetch('/api/chat/rooms/available')
        if (availableResponse.ok) {
          const availableData = await availableResponse.json()
          if (availableData.ok && availableData.data?.rooms) {
            setAvailableRooms(availableData.data.rooms)
          }
        }
      } else {
        alert(data.message || 'Failed to join room')
      }
    } catch (err) {
      console.error('Error joining room:', err)
      alert('Failed to join room')
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className="h-full bg-slate-950 text-white flex overflow-hidden">
      {/* Room Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full flex-shrink-0">
        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Rooms</h2>
            <button
              onClick={() => setShowRoomSelector(!showRoomSelector)}
              className="px-3 py-1 text-sm bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
            >
              {showRoomSelector ? 'Hide' : 'Join'}
            </button>
          </div>
        </div>

        {/* Available Rooms to Join */}
        {showRoomSelector && availableRooms.length > 0 && (
          <div className="p-4 border-b border-slate-800 flex-shrink-0 max-h-48 overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Available Rooms</h3>
            <div className="space-y-2">
              {availableRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleJoinRoom(room)}
                  className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{room.name}</span>
                  <span className="text-xs text-slate-400 ml-2 flex-shrink-0">
                    {room._count?.members || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* My Rooms */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <h3 className="text-sm font-medium text-slate-400 mb-2">My Rooms</h3>
          <div className="space-y-2">
            {myRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => {
                  setRoomId(room.id)
                  setRoomName(room.name)
                  setShowRoomSelector(false)
                }}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${
                  roomId === room.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                <span className="truncate">{room.name}</span>
                {room._count && (
                  <span className="text-xs opacity-70 ml-2 flex-shrink-0">
                    {room._count.messages || 0}
                  </span>
                )}
              </button>
            ))}
          </div>
          {myRooms.length === 0 && (
            <p className="text-sm text-slate-500 mt-4">
              No rooms yet. Click "Join" to find rooms.
            </p>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {roomId ? (
          <ChatRoom roomId={roomId} roomName={roomName} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400 mb-4">Select a room to start chatting</p>
              {availableRooms.length > 0 && (
                <button
                  onClick={() => setShowRoomSelector(true)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
                >
                  Join a Room
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
