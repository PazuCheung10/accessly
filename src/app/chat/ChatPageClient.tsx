'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ChatRoom } from '@/components/ChatRoom'

interface Room {
  id: string
  name: string
  title?: string
  description?: string
  tags?: string[]
  type?: string
  isPrivate: boolean
  _count?: {
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
  otherUser?: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  } | null
}

interface ChatPageClientProps {
  initialRoomId: string | null
  initialView?: 'rooms' | 'inbox' // Deprecated - kept for backward compatibility
}

export default function ChatPageClient({ initialRoomId }: ChatPageClientProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [roomId, setRoomId] = useState<string | null>(initialRoomId)
  const [roomName, setRoomName] = useState<string>('General')
  const [myRooms, setMyRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in?callbackUrl=/chat')
    }
  }, [status, router])

  // Fetch rooms only when authenticated - depend on status, not session object
  useEffect(() => {
    if (status !== 'authenticated') {
      if (status === 'unauthenticated') {
        setIsLoading(false)
      }
      return
    }

    const fetchRooms = async () => {
      try {
        setIsLoading(true)
        console.log('Fetching rooms for user:', session?.user?.email, session?.user?.id)
        
        // Fetch rooms user is a member of
        const myRoomsResponse = await fetch('/api/chat/rooms')
        
        if (!myRoomsResponse.ok) {
          console.error('My rooms API error:', {
            status: myRoomsResponse.status,
            statusText: myRoomsResponse.statusText,
          })
          const errorText = await myRoomsResponse.text()
          console.error('Error response body:', errorText)
          return
        }
        
        const myRoomsData = await myRoomsResponse.json()
        console.log('📦 My rooms API response (RAW):', JSON.stringify(myRoomsData, null, 2))
        console.log('📦 My rooms API response (parsed):', myRoomsData)
        
        // Check multiple possible response formats
        let rooms: Room[] = []
        
        if (myRoomsData.ok && myRoomsData.data?.rooms) {
          rooms = myRoomsData.data.rooms
          console.log('✅ Found rooms in data.rooms:', rooms.length)
        } else if (myRoomsData.rooms) {
          rooms = myRoomsData.rooms
          console.log('✅ Found rooms in root:', rooms.length)
        } else if (Array.isArray(myRoomsData)) {
          rooms = myRoomsData
          console.log('✅ Response is array:', rooms.length)
        } else {
          console.error('❌ No rooms found in response structure:', {
            hasOk: !!myRoomsData.ok,
            hasData: !!myRoomsData.data,
            hasRooms: !!myRoomsData.rooms,
            isArray: Array.isArray(myRoomsData),
            keys: Object.keys(myRoomsData),
          })
        }
        
        console.log('✅ Setting rooms state:', rooms.length, rooms.map(r => ({ id: r.id, name: r.name })))
        setMyRooms(rooms)
        
        // Handle initial room selection
        if (initialRoomId) {
          // Check if URL room is already in user's rooms
          const targetRoom = rooms.find((r) => r.id === initialRoomId)
          if (targetRoom) {
            // Room is in user's list - select it
            const displayName = targetRoom.name || targetRoom.title || 'General'
            setRoomName(displayName)
            setRoomId(initialRoomId)
            return
          }
          
          // Room not in user's list - try to join it (if public)
          console.log('Room not in my rooms, attempting to join:', initialRoomId)
          try {
            const joinResponse = await fetch(`/api/chat/rooms/${initialRoomId}/join`, {
              method: 'POST',
            })
            
            const joinData = await joinResponse.json()
            
            if (joinResponse.ok && joinData.ok) {
              // Successfully joined - refresh rooms list
              console.log('✅ Successfully joined room, refreshing...')
              const refreshResponse = await fetch('/api/chat/rooms')
              const refreshData = await refreshResponse.json()
              
              if (refreshData.ok && refreshData.data?.rooms) {
                const updatedRooms = refreshData.data.rooms
                setMyRooms(updatedRooms)
                
                // Find the room we just joined
                const joinedRoom = updatedRooms.find((r: Room) => r.id === initialRoomId)
                if (joinedRoom) {
                  setRoomName(joinedRoom.name || joinedRoom.title || 'General')
                  setRoomId(initialRoomId)
                  return
                }
              }
            } else {
              // Join failed (might be private or doesn't exist)
              console.warn('Failed to join room:', joinData.message)
              // Check if room exists and get its details
              const roomResponse = await fetch(`/api/chat/rooms/${initialRoomId}`)
              const roomData = await roomResponse.json()
              
              if (roomResponse.ok && roomData.ok && roomData.data?.room) {
                // Room exists but join failed - might be private
                alert(`Cannot access room: ${joinData.message || 'Room is private or requires invitation'}`)
              }
            }
          } catch (err) {
            console.error('Error joining room:', err)
          }
        }
        
        // If no room selected yet, pick first PUBLIC or PRIVATE room
        if (!roomId && rooms.length > 0) {
          // Filter to only PUBLIC and PRIVATE rooms (exclude DM and TICKET)
          const teamRooms = rooms.filter((r) => r.type === 'PUBLIC' || r.type === 'PRIVATE')
          
          if (teamRooms.length > 0) {
            const firstRoom = teamRooms[0]
            const displayName = firstRoom.name || firstRoom.title || 'General'
            setRoomName(displayName)
            setRoomId(firstRoom.id)
          } else {
            // No team rooms available - clear selection
            setRoomId(null)
            setRoomName('')
          }
        }

        // Note: Available rooms are now shown on the home page (forum)
        // Chat page only shows rooms the user has joined
      } catch (err) {
        console.error('Error fetching rooms:', err)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchRooms()
    // Only depend on status, not session object to avoid noisy re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

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
            <h2 className="text-lg font-semibold">Chat</h2>
            <a
              href="/"
              className="px-3 py-1 text-sm bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
            >
              Discover
            </a>
          </div>
          <div className="text-xs text-slate-500">
            Signed in as: {session.user?.email}
          </div>
        </div>

        {/* Rooms Header */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-400">Rooms</h3>
        </div>

        {/* Room Lists */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {(() => {
            // Only show PUBLIC and PRIVATE rooms (exclude DM and TICKET)
            const teamRooms = myRooms.filter((r) => r.type === 'PUBLIC' || r.type === 'PRIVATE')
            
            if (teamRooms.length === 0) {
              return (
                <div className="text-xs text-slate-500 p-4 text-center">
                  <div>No rooms found</div>
                  <a
                    href="/"
                    className="mt-2 inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-sm transition-colors"
                  >
                    Discover Rooms
                  </a>
                </div>
              )
            }
            
            return (
              <div className="space-y-1">
                {teamRooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => {
                      if (roomId !== room.id) {
                        setRoomName(room.name || room.title || 'General')
                        setRoomId(room.id)
                        // Update URL (remove view param since we only have one view now)
                        const params = new URLSearchParams(window.location.search)
                        params.set('room', room.id)
                        params.delete('view') // Remove view param
                        router.push(`/chat?${params.toString()}`, { scroll: false })
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${
                      roomId === room.id
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    <span className="truncate">{room.name || room.title}</span>
                    {room._count && (
                      <span className="text-xs opacity-70 ml-2 flex-shrink-0">
                        {room._count.messages || 0}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {roomId ? (
          <ChatRoom 
            roomId={roomId} 
            roomName={roomName}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400 mb-4">Select a room to start chatting</p>
              <a
                href="/"
                className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
              >
                Discover Rooms
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

