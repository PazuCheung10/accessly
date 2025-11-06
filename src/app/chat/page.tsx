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

  // Check for room parameter from URL and store it
  useEffect(() => {
    const checkRoomParam = async () => {
      const params = await searchParams
      if (params.room) {
        setInitialRoomId(params.room)
      }
    }
    checkRoomParam()
  }, [searchParams])

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
        
        console.log('✅ Setting rooms state:', rooms.length, rooms.map(r => ({ id: r.id, name: r.name })))
        setMyRooms(rooms)
        
        // Check if we have a room ID from URL
        const checkUrlRoom = async () => {
          const params = await searchParams
          const urlRoomId = params.room || initialRoomId
          
          if (!urlRoomId) {
            // No URL room param - select first room if available
            if (rooms.length > 0) {
              const firstRoom = rooms[0]
              setRoomName(firstRoom.name || firstRoom.title || 'General')
              setRoomId(firstRoom.id)
            }
            return
          }
          
          // Check if URL room is already in user's rooms
          const targetRoom = rooms.find((r) => r.id === urlRoomId)
          if (targetRoom) {
            // Room is in user's list - select it
            setRoomName(targetRoom.name || targetRoom.title || 'General')
            setRoomId(urlRoomId)
            return
          }
          
          // Room not in user's list - try to join it (if public)
          console.log('Room not in my rooms, attempting to join:', urlRoomId)
          try {
            const joinResponse = await fetch(`/api/chat/rooms/${urlRoomId}/join`, {
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
                const joinedRoom = updatedRooms.find((r: Room) => r.id === urlRoomId)
                if (joinedRoom) {
                  setRoomName(joinedRoom.name || joinedRoom.title || 'General')
                  setRoomId(urlRoomId)
                } else {
                  // Fallback to first room
                  if (updatedRooms.length > 0) {
                    const firstRoom = updatedRooms[0]
                    setRoomName(firstRoom.name || firstRoom.title || 'General')
                    setRoomId(firstRoom.id)
                  }
                }
              }
            } else {
              // Join failed (might be private or doesn't exist)
              console.warn('Failed to join room:', joinData.message)
              // Check if room exists and get its details
              const roomResponse = await fetch(`/api/chat/rooms/${urlRoomId}`)
              const roomData = await roomResponse.json()
              
              if (roomResponse.ok && roomData.ok && roomData.data?.room) {
                // Room exists but join failed - might be private
                // Show error and select first room
                alert(`Cannot access room: ${joinData.message || 'Room is private or requires invitation'}`)
              }
              
              // Fallback to first room
              if (rooms.length > 0) {
                const firstRoom = rooms[0]
                setRoomName(firstRoom.name || firstRoom.title || 'General')
                setRoomId(firstRoom.id)
              }
            }
          } catch (err) {
            console.error('Error joining room:', err)
            // Fallback to first room
            if (rooms.length > 0) {
              const firstRoom = rooms[0]
              setRoomName(firstRoom.name || firstRoom.title || 'General')
              setRoomId(firstRoom.id)
            }
          }
        }
        
        // Check URL room after rooms are loaded
        checkUrlRoom()

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
                      setRoomName(room.name || room.title || 'General') // Update name immediately for smooth transition
                      setRoomId(room.id)
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
          {myRooms.length === 0 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-500 mb-2">
                You're not in any rooms yet.
              </p>
              <a
                href="/"
                className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-sm transition-colors"
              >
                Discover Rooms
              </a>
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
