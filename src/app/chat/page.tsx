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
}

export default function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string>('General')
  const [initialRoomId, setInitialRoomId] = useState<string | null>(null)
  const [myRooms, setMyRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitchingRoom, setIsSwitchingRoom] = useState(false)

  // Check for room parameter from URL
  useEffect(() => {
    const checkRoomParam = async () => {
      const params = await searchParams
      if (params.room && !roomId) {
        setInitialRoomId(params.room)
      }
    }
    checkRoomParam()
  }, [searchParams, roomId])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in?callbackUrl=/chat')
    }
  }, [status, router])

  // Fetch rooms only once on mount (not when roomId changes)
  useEffect(() => {
    // Log session state for debugging
    console.log('Chat page session state:', {
      status,
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userRole: session?.user?.role,
    })

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
        
        if (rooms.length > 0) {
          console.log('✅ Setting rooms state:', rooms.length, rooms.map(r => ({ id: r.id, name: r.name })))
                  setMyRooms(rooms)
                  
                  // Auto-select room: URL param > initial room > first room
                  setRoomId((currentRoomId) => {
                    if (currentRoomId) return currentRoomId // Keep current selection
                    
                    if (initialRoomId) {
                      // Check if initialRoomId is in the rooms list
                      const targetRoom = rooms.find((r) => r.id === initialRoomId)
                      if (targetRoom) {
                        setRoomName(targetRoom.name || targetRoom.title || 'General')
                        return initialRoomId
                      }
                    }
                    
                    // Fallback to first room
                    if (rooms.length > 0) {
                      const firstRoom = rooms[0]
                      setRoomName(firstRoom.name || firstRoom.title || 'General')
                      return firstRoom.id
                    }
                    
                    return currentRoomId
                  })
        } else {
          console.error('❌ My rooms response format error:', {
            ok: myRoomsData.ok,
            hasData: !!myRoomsData.data,
            hasRooms: !!myRoomsData.data?.rooms,
            fullResponse: myRoomsData
          })
          // Still set empty array to clear loading state
          setMyRooms([])
        }

        // Note: Available rooms are now shown on the home page (forum)
        // Chat page only shows rooms the user has joined
      } catch (err) {
        console.error('Error fetching rooms:', err)
      } finally {
        setIsLoading(false)
      }
    }
    
    // Fetch when authenticated (more reliable than checking session.user.id)
    if (status === 'authenticated') {
      fetchRooms()
    } else if (status === 'unauthenticated') {
      console.warn('User not authenticated, redirecting to sign-in')
      setIsLoading(false)
    } else if (status === 'loading') {
      // Still loading, wait
      console.log('Session loading, waiting...')
    } else {
      // Fallback: if we have session but status is weird, still try to fetch
      // (API route will handle auth)
      if (session?.user) {
        console.warn('Session exists but status is not authenticated, attempting fetch anyway')
        fetchRooms()
      } else {
        console.warn('No session, skipping room fetch')
        setIsLoading(false)
      }
    }
  }, [status, session]) // Depend on status and session


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
            <h2 className="text-lg font-semibold">My Rooms</h2>
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

        {/* My Rooms */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">My Rooms</h3>
            <button
              onClick={async () => {
                console.log('=== MANUAL DEBUG TEST ===')
                console.log('Session:', session)
                console.log('My Rooms State:', myRooms)
                console.log('Available Rooms State:', availableRooms)
                
                // Test direct API call
                try {
                  const res = await fetch('/api/chat/rooms')
                  const data = await res.json()
                  console.log('Direct API call result:', data)
                } catch (e) {
                  console.error('Direct API call error:', e)
                }
                
                // Test debug endpoint
                try {
                  const res = await fetch('/api/debug/rooms')
                  const data = await res.json()
                  console.log('Debug endpoint result:', data)
                  alert(`Debug: ${JSON.stringify(data, null, 2)}`)
                } catch (e) {
                  console.error('Debug endpoint error:', e)
                }
              }}
              className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded"
              title="Debug: Check console"
            >
              🐛
            </button>
          </div>
          <div className="space-y-2">
            {myRooms.length === 0 ? (
              <div className="text-xs text-slate-500 p-2">
                <div>No rooms found</div>
                <div className="mt-1 text-slate-600">
                  Check console for debug info
                </div>
              </div>
            ) : (
              myRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => {
                    if (roomId !== room.id) {
                      setIsSwitchingRoom(true)
                      setRoomName(room.name) // Update name immediately for smooth transition
                      setRoomId(room.id)
                      setShowRoomSelector(false)
                      // Clear loading state after messages load (handled by ChatRoom)
                    }
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
              ))
            )}
          </div>
          {myRooms.length === 0 && availableRooms.length === 0 && (
            <p className="text-sm text-slate-500 mt-4">
              No rooms available. Rooms may need to be created.
            </p>
          )}
          {myRooms.length === 0 && availableRooms.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-slate-500 mb-2">
                You're not in any rooms yet.
              </p>
              <button
                onClick={() => setShowRoomSelector(true)}
                className="w-full px-3 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
              >
                Join Available Rooms
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {roomId ? (
          <ChatRoom 
            roomId={roomId} 
            roomName={roomName} 
            isSwitchingRoom={isSwitchingRoom}
            onMessagesLoaded={() => setIsSwitchingRoom(false)}
          />
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
