'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChatRoom } from '@/components/ChatRoom'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { initSocket } from '@/lib/socket'
import { useChatStore } from '@/lib/chatStore'

interface Room {
  id: string
  name: string
  title?: string
  description?: string
  tags?: string[]
  type?: string
  isPrivate: boolean
  status?: 'OPEN' | 'WAITING' | 'RESOLVED' | null // For TICKET rooms
  ticketDepartment?: string | null // For TICKET rooms
  createdAt?: string
  updatedAt?: string
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

interface Ticket {
  id: string
  roomId: string // Explicitly include roomId (same as id, but makes it clear)
  name: string
  title: string
  status: 'OPEN' | 'WAITING' | 'RESOLVED' | null
  department: string | null
  messageCount: number
  updatedAt?: string
  lastMessage?: {
    id: string
    content: string
    createdAt: string
    user: {
      id: string
      name: string | null
      email: string | null
    }
  } | null
}

export default function ChatPageClient({ initialRoomId }: ChatPageClientProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [roomId, setRoomId] = useState<string | null>(initialRoomId)
  const [roomName, setRoomName] = useState<string>('General')
  const [myRooms, setMyRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'rooms' | 'tickets'>('rooms')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)
  const [isExternalCustomer, setIsExternalCustomer] = useState<boolean | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in?callbackUrl=/chat')
    }
  }, [status, router])

  // Check if user is external customer
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      return
    }

    const checkUserType = async () => {
      try {
        // We'll use a simple heuristic: check if user has any PUBLIC/PRIVATE room memberships
        // If not, they're likely an external customer
        const response = await fetch('/api/chat/rooms')
        const data = await response.json()
        
        if (data.ok && data.data?.rooms) {
          const rooms = data.data.rooms
          const hasInternalRooms = rooms.some((r: Room) => r.type === 'PUBLIC' || r.type === 'PRIVATE')
          setIsExternalCustomer(!hasInternalRooms && session?.user?.role !== 'ADMIN')
        } else {
          // If API fails, assume internal user for safety
          setIsExternalCustomer(false)
        }
      } catch (err) {
        console.error('Error checking user type:', err)
        setIsExternalCustomer(false)
      }
    }

    checkUserType()
  }, [status, session?.user?.id, session?.user?.role])

  // Fetch tickets when tickets/issues tab is active (for admins and non-admin users) or for external customers
  useEffect(() => {
    if (status !== 'authenticated') {
      return
    }

    // For admins: fetch all tickets when tickets tab is active
    if (session?.user?.role === 'ADMIN' && activeTab === 'tickets') {
      const fetchTickets = async () => {
        try {
          setIsLoadingTickets(true)
          const response = await fetch('/api/tickets')
          const data = await response.json()
          
          if (data.ok && data.data?.tickets) {
            setTickets(data.data.tickets)
          }
        } catch (err) {
          console.error('Error fetching tickets:', err)
        } finally {
          setIsLoadingTickets(false)
        }
      }

      fetchTickets()
      return
    }

    // For non-admin internal users: fetch their assigned tickets when issues tab is active
    if (session?.user?.role !== 'ADMIN' && isExternalCustomer !== true && activeTab === 'tickets') {
      const fetchMyTickets = async () => {
        try {
          setIsLoadingTickets(true)
          const response = await fetch('/api/tickets/my-tickets')
          const data = await response.json()
          
          if (data.ok && data.data?.tickets) {
            setTickets(data.data.tickets)
          }
        } catch (err) {
          console.error('Error fetching my tickets:', err)
        } finally {
          setIsLoadingTickets(false)
        }
      }

      fetchMyTickets()
      return
    }

    // For external customers: fetch their tickets on mount
    if (isExternalCustomer === true) {
      const fetchMyTickets = async () => {
        try {
          setIsLoadingTickets(true)
          const response = await fetch('/api/tickets/my-tickets')
          const data = await response.json()
          
          if (data.ok && data.data?.tickets) {
            setTickets(data.data.tickets)
          }
        } catch (err) {
          console.error('Error fetching my tickets:', err)
        } finally {
          setIsLoadingTickets(false)
        }
      }

      fetchMyTickets()
    }
  }, [activeTab, status, session?.user?.role, isExternalCustomer])

  // Auto-switch tab based on room type when roomId changes
  useEffect(() => {
    if (!roomId || isExternalCustomer === true) return // External customers don't have tabs

    // Find the room in myRooms to check its type
    const currentRoom = myRooms.find((r) => r.id === roomId)
    if (currentRoom) {
      if (currentRoom.type === 'TICKET') {
        setActiveTab('tickets')
      } else if (currentRoom.type === 'PUBLIC' || currentRoom.type === 'PRIVATE') {
        setActiveTab('rooms')
      }
    } else {
      // Room not in myRooms yet - fetch room details to check type
      const checkRoomType = async () => {
        try {
          const response = await fetch(`/api/chat/rooms/${roomId}`)
          const data = await response.json()
          if (data.ok && data.data?.room) {
            const room = data.data.room
            if (room.type === 'TICKET') {
              setActiveTab('tickets')
            } else if (room.type === 'PUBLIC' || room.type === 'PRIVATE') {
              setActiveTab('rooms')
            }
          }
        } catch (err) {
          console.error('Error checking room type:', err)
        }
      }
      checkRoomType()
    }
  }, [roomId, myRooms, isExternalCustomer])

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
            // Switch to tickets tab if it's a ticket
            if (targetRoom.type === 'TICKET') {
              setActiveTab('tickets')
            }
            return
          }
          
          // Room not in user's list - check if we can access it
          console.log('Room not in my rooms, checking access:', initialRoomId)
          try {
            // First, check if we can access the room (for tickets, this will check membership or admin status)
            const roomResponse = await fetch(`/api/chat/rooms/${initialRoomId}`)
            const roomData = await roomResponse.json()
            
            if (roomResponse.ok && roomData.ok && roomData.data?.room) {
              const room = roomData.data.room
              
              // If it's a public room, try to join it
              if (room.type === 'PUBLIC') {
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
                  }
                }
              }
              
              // If we have access (member or admin for tickets), select the room
              // Note: API now returns isMember=true for admins on tickets
              if (room.isMember) {
                const displayName = room.name || room.title || 'General'
                setRoomName(displayName)
                setRoomId(initialRoomId)
                // Switch to tickets tab if it's a ticket
                if (room.type === 'TICKET') {
                  setActiveTab('tickets')
                }
                return
              } else {
                // No access - redirect to appropriate page
                if (room.type === 'TICKET') {
                  // For tickets, redirect to issues page
                  router.push('/issues')
                } else {
                  // For other rooms, redirect to home
                  router.push('/')
                }
                return
              }
            } else {
              // Room doesn't exist or access denied - redirect to home
              console.warn('Cannot access room:', roomData.message)
              router.push('/')
              return
            }
          } catch (err) {
            console.error('Error checking room access:', err)
          }
        }
        
        // If no room selected yet, pick first available room
        if (!roomId && rooms.length > 0) {
          // For external customers: pick first TICKET room
          // For internal users: pick first PUBLIC, PRIVATE, or TICKET room (assigned tickets)
          let firstRoom
          if (isExternalCustomer === true) {
            firstRoom = rooms.find((r) => r.type === 'TICKET')
          } else {
            firstRoom = rooms.find((r) => r.type === 'PUBLIC' || r.type === 'PRIVATE' || r.type === 'TICKET')
          }
          
          if (firstRoom) {
            const displayName = firstRoom.name || firstRoom.title || (firstRoom.type === 'TICKET' ? 'Ticket' : 'General')
            setRoomName(displayName)
            setRoomId(firstRoom.id)
            // Switch to tickets tab if it's a ticket
            if (firstRoom.type === 'TICKET') {
              setActiveTab('tickets')
            }
          } else {
            // No rooms available - clear selection
            setRoomId(null)
            setRoomName('')
          }
        }

        // Note: Available rooms are now shown on the home page (Team Workspace)
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

  // Join all user rooms via socket and listen for messages
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || myRooms.length === 0) return

    const socket = initSocket(session.user.id)

    // Join all rooms the user is a member of
    myRooms.forEach((room) => {
      socket.emit('room:join', { roomId: room.id, userId: session.user.id })
    })

    const handleMessageNew = (message: any) => {
      // Validate message structure
      if (!message || !message.roomId || !message.id) {
        return
      }

      // Always update chat store for real-time message display
      const { upsertMessages } = useChatStore.getState()
      upsertMessages(message.roomId, [{
        id: message.id,
        roomId: message.roomId,
        userId: message.userId,
        content: message.content,
        parentMessageId: message.parentMessageId || null,
        createdAt: message.createdAt,
        editedAt: message.editedAt || null,
        deletedAt: message.deletedAt || null,
        reactions: message.reactions || null,
        user: message.user,
      }])

      // Determine room type - check both myRooms and tickets list
      const roomInMyRooms = myRooms.find((r) => r.id === message.roomId)
      const ticketInList = tickets.find((t) => t.roomId === message.roomId || t.id === message.roomId)
      const isTicketRoom = roomInMyRooms?.type === 'TICKET' || !!ticketInList

      // Update the appropriate list based on room type, not active tab
      // TICKET rooms update tickets list, other rooms update myRooms
      if (isTicketRoom) {
        // Update tickets list (for Issues tab)
        setTickets((prevTickets) => {
          const ticketIndex = prevTickets.findIndex((t) => t.roomId === message.roomId || t.id === message.roomId)
          if (ticketIndex === -1) {
            return prevTickets
          }

          const updatedTickets = [...prevTickets]
          updatedTickets[ticketIndex] = {
            ...updatedTickets[ticketIndex],
            lastMessage: {
              id: message.id,
              content: message.content,
              createdAt: message.createdAt,
              user: message.user,
            },
            updatedAt: message.createdAt,
          }

          // Re-sort by last activity
          return updatedTickets.sort((a, b) => {
            const aTime = a.lastMessage?.createdAt
              ? new Date(a.lastMessage.createdAt).getTime()
              : a.updatedAt
              ? new Date(a.updatedAt).getTime()
              : 0
            const bTime = b.lastMessage?.createdAt
              ? new Date(b.lastMessage.createdAt).getTime()
              : b.updatedAt
              ? new Date(b.updatedAt).getTime()
              : 0
            return bTime - aTime
          })
        })
      } else {
        // Update room list (for Rooms tab) - only for PUBLIC/PRIVATE rooms
        setMyRooms((prevRooms) => {
          const roomIndex = prevRooms.findIndex((r) => r.id === message.roomId)
          if (roomIndex === -1) {
            // Room not in list, might need to fetch it
            return prevRooms
          }

          // Update the room's lastMessage and updatedAt
          const updatedRooms = [...prevRooms]
          updatedRooms[roomIndex] = {
            ...updatedRooms[roomIndex],
            lastMessage: {
              id: message.id,
              content: message.content,
              createdAt: message.createdAt,
              user: message.user,
            },
            updatedAt: message.createdAt,
          }

          // Re-sort by last activity (most recent first)
          return updatedRooms.sort((a, b) => {
            const aTime = a.lastMessage?.createdAt
              ? new Date(a.lastMessage.createdAt).getTime()
              : a.updatedAt
              ? new Date(a.updatedAt).getTime()
              : 0
            const bTime = b.lastMessage?.createdAt
              ? new Date(b.lastMessage.createdAt).getTime()
              : b.updatedAt
              ? new Date(b.updatedAt).getTime()
              : 0
            return bTime - aTime
          })
        })
      }
    }

    socket.on('message:new', handleMessageNew)

    return () => {
      socket.off('message:new', handleMessageNew)
      // Leave all rooms when component unmounts
      myRooms.forEach((room) => {
        socket.emit('room:leave', { roomId: room.id, userId: session.user.id })
      })
    }
  }, [status, session?.user?.id, myRooms, tickets])

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
      {/* Room Sidebar - Show for all users (external customers see their tickets) */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full flex-shrink-0">
        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {isExternalCustomer === true ? 'My Tickets' : 'Chat'}
            </h2>
            {isExternalCustomer !== true && (
              <Link
                href="/"
                className="px-3 py-1 text-sm bg-cyan-600 hover:bg-cyan-700 rounded transition-colors"
              >
                Discover
              </Link>
            )}
          </div>
        </div>

        {/* Tab Switcher - For admins and non-admin internal users (not external customers) */}
        {isExternalCustomer !== true && (
          <div className="p-4 border-b border-slate-800">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('rooms')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                  activeTab === 'rooms'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Rooms
              </button>
              <button
                onClick={() => setActiveTab('tickets')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                  activeTab === 'tickets'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Issues
              </button>
            </div>
          </div>
        )}

        {/* Room/Ticket Lists */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {isExternalCustomer === true ? (
            // External customers: show ONLY their TICKET rooms with nice card styling
            (() => {
              const ticketRooms = myRooms.filter((r) => r.type === 'TICKET')
              
              // Helper functions for ticket display (reused from TicketsList)
              const getStatusColor = (status: string | null | undefined) => {
                switch (status) {
                  case 'OPEN':
                    return 'bg-green-500/20 text-green-400 border-green-500/30'
                  case 'WAITING':
                    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  case 'RESOLVED':
                    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                  default:
                    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                }
              }

              const getDepartmentLabel = (department: string | null | undefined) => {
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

              const getDepartmentColor = (department: string | null | undefined) => {
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

              const cleanTitle = (title: string | null | undefined) => {
                if (!title) return 'Ticket'
                return title.replace(/^\[TICKET\]\[[^\]]+\]\s*/, '').replace(/^\[TICKET\]\s*/, '').replace(/^\[[^\]]+\]\s*/, '').trim()
              }
              
              if (ticketRooms.length === 0) {
                return (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
                    <p className="text-slate-400 mb-4">No issues found</p>
                    <a
                      href="/support"
                      className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-sm transition-colors"
                    >
                      Create Ticket
                    </a>
                  </div>
                )
              }
              
              return (
                <div className="space-y-3">
                  {ticketRooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => {
                        if (roomId !== room.id) {
                          setRoomName(room.name || room.title || 'Ticket')
                          setRoomId(room.id)
                          const params = new URLSearchParams(window.location.search)
                          params.set('room', room.id)
                          params.delete('view')
                          router.push(`/chat?${params.toString()}`, { scroll: false })
                        }
                      }}
                      className={`w-full text-left bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:bg-slate-800 transition-colors ${
                        roomId === room.id ? 'ring-2 ring-cyan-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-slate-200 truncate">
                              {cleanTitle(room.title || room.name)}
                            </h3>
                            {room.ticketDepartment && (
                              <span
                                className={`px-2 py-0.5 text-xs font-semibold rounded border flex-shrink-0 ${getDepartmentColor(room.ticketDepartment)}`}
                              >
                                {getDepartmentLabel(room.ticketDepartment)}
                              </span>
                            )}
                            {room.status && (
                              <span
                                className={`px-2 py-0.5 text-xs rounded border flex-shrink-0 ${getStatusColor(room.status)}`}
                              >
                                {room.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {room.lastMessage && (
                        <div className="bg-slate-900/50 rounded p-2 mb-2">
                          <p className="text-xs text-slate-300 line-clamp-2">
                            {room.lastMessage.content}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {room._count?.messages || 0} {room._count?.messages === 1 ? 'message' : 'messages'}
                        </span>
                        {room.updatedAt && (
                          <span>Updated {new Date(room.updatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )
            })()
          ) : activeTab === 'rooms' ? (
            (() => {
              // Helper function to clean room titles (remove prefixes like [TICKET][Department])
              const cleanTitle = (title: string | null | undefined, name: string | null | undefined, type?: string) => {
                if (!title && !name) return type === 'TICKET' ? 'Ticket' : 'General'
                const titleToClean = title || name || ''
                // Remove [TICKET][Department] or [Department] prefixes
                const cleaned = titleToClean.replace(/^\[TICKET\]\[[^\]]+\]\s*/, '').replace(/^\[TICKET\]\s*/, '').replace(/^\[[^\]]+\]\s*/, '').trim()
                return cleaned || (type === 'TICKET' ? 'Ticket' : 'General')
              }

              // Show only PUBLIC and PRIVATE rooms in Rooms tab
              // TICKET rooms should only appear in Issues tab
              // Sort by last activity (lastMessage createdAt or room updatedAt)
              const teamRooms = myRooms
                .filter((r) => r.type === 'PUBLIC' || r.type === 'PRIVATE')
                .sort((a, b) => {
                  const aTime = a.lastMessage?.createdAt 
                    ? new Date(a.lastMessage.createdAt).getTime()
                    : a.updatedAt 
                    ? new Date(a.updatedAt).getTime()
                    : 0
                  const bTime = b.lastMessage?.createdAt
                    ? new Date(b.lastMessage.createdAt).getTime()
                    : b.updatedAt
                    ? new Date(b.updatedAt).getTime()
                    : 0
                  return bTime - aTime // Most recent first
                })
              
              if (teamRooms.length === 0) {
                return (
                  <div className="text-xs text-slate-500 p-4 text-center">
                    <div>No rooms found</div>
                    <Link
                      href="/"
                      className="mt-2 inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-sm transition-colors"
                    >
                      Discover Rooms
                    </Link>
                  </div>
                )
              }
              
              return (
                <div className="space-y-1">
                  {teamRooms.map((room) => {
                    const displayTitle = cleanTitle(room.title, room.name, room.type)
                    return (
                      <button
                        key={room.id}
                        onClick={() => {
                          if (roomId !== room.id) {
                            setRoomName(displayTitle)
                            setRoomId(room.id)
                            // Switch to tickets tab if it's a ticket
                            if (room.type === 'TICKET') {
                              setActiveTab('tickets')
                            }
                            // Update URL (remove view param since we only have one view now)
                            const params = new URLSearchParams(window.location.search)
                            params.set('room', room.id)
                            params.delete('view') // Remove view param
                            router.push(`/chat?${params.toString()}`, { scroll: false })
                          }
                        }}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        roomId === room.id
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-medium">{displayTitle}</span>
                          {room._count && (
                            <span className="text-xs opacity-70 flex-shrink-0 ml-2">
                              {room._count.messages || 0}
                            </span>
                          )}
                        </div>
                        {room.lastMessage && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs opacity-60 truncate flex-1">
                              {room.lastMessage.user?.name || 'Someone'}: {room.lastMessage.content.length > 50 
                                ? room.lastMessage.content.slice(0, 50) + '...'
                                : room.lastMessage.content}
                            </span>
                            <span className="text-xs opacity-50 flex-shrink-0">
                              {new Date(room.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                    )
                  })}
                </div>
              )
            })()
          ) : (
            // Tickets/Issues tab (admin sees all tickets, non-admin sees assigned issues)
            (() => {
              const cleanTitle = (title: string | null) => {
                if (!title) return ''
                return title.replace(/^\[TICKET\]\[[^\]]+\]\s*/, '').replace(/^\[TICKET\]\s*/, '').replace(/^\[[^\]]+\]\s*/, '').trim()
              }

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

              const getStatusColor = (status: string | null) => {
                switch (status) {
                  case 'OPEN':
                    return 'bg-green-500/20 text-green-400 border-green-500/30'
                  case 'WAITING':
                    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  case 'RESOLVED':
                    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                  default:
                    return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                }
              }

              if (isLoadingTickets) {
                return (
                  <div className="text-xs text-slate-500 p-4 text-center">
                    Loading issues...
                  </div>
                )
              }

              if (tickets.length === 0) {
                return (
                  <div className="text-xs text-slate-500 p-4 text-center">
                    <div>{session?.user?.role === 'ADMIN' ? 'No issues found' : 'No issues assigned to you'}</div>
                    {session?.user?.role === 'ADMIN' ? (
                      <Link
                        href="/tickets"
                        className="mt-2 inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-sm transition-colors"
                      >
                        View All Issues
                      </Link>
                    ) : (
                      <p className="mt-2 text-xs text-slate-600">Issues will appear here once you're assigned to them</p>
                    )}
                  </div>
                )
              }

              // Sort tickets by last activity (lastMessage createdAt or ticket updatedAt)
              const sortedTickets = [...tickets].sort((a, b) => {
                const aTime = a.lastMessage?.createdAt
                  ? new Date(a.lastMessage.createdAt).getTime()
                  : a.updatedAt
                  ? new Date(a.updatedAt).getTime()
                  : 0
                const bTime = b.lastMessage?.createdAt
                  ? new Date(b.lastMessage.createdAt).getTime()
                  : b.updatedAt
                  ? new Date(b.updatedAt).getTime()
                  : 0
                return bTime - aTime // Most recent first
              })

              return (
                <div className="space-y-1">
                  {sortedTickets.map((ticket) => {
                    // Use ticket.roomId explicitly (same as ticket.id, but makes intent clear)
                    // Tickets ARE Room records, so ticket.id === ticket.roomId === room.id
                    const ticketRoomId = ticket.roomId || ticket.id
                    
                    // DEBUG: Log ticket roomId mapping
                    console.log('DEBUG ticket chat', {
                      ticketId: ticket.id,
                      ticketRoomId: ticket.roomId || ticket.id,
                      roomIdUsedForMessages: ticketRoomId,
                      match: ticket.id === ticketRoomId,
                    })
                    
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => {
                          if (roomId !== ticketRoomId) {
                            setRoomName(cleanTitle(ticket.title) || ticket.name || 'Ticket')
                            setRoomId(ticketRoomId)
                            // Ensure we're on the tickets tab
                            setActiveTab('tickets')
                            const params = new URLSearchParams(window.location.search)
                            params.set('room', ticketRoomId)
                            router.push(`/chat?${params.toString()}`, { scroll: false })
                          }
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          roomId === ticketRoomId
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs font-medium">
                            {cleanTitle(ticket.title)}
                          </span>
                          <span className="text-xs opacity-70 flex-shrink-0 ml-2">
                            {ticket.messageCount || 0}
                          </span>
                        </div>
                        {ticket.lastMessage && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs opacity-60 truncate flex-1">
                              {ticket.lastMessage.user?.name || 'Someone'}: {ticket.lastMessage.content.length > 50
                                ? ticket.lastMessage.content.slice(0, 50) + '...'
                                : ticket.lastMessage.content}
                            </span>
                            <span className="text-xs opacity-50 flex-shrink-0">
                              {new Date(ticket.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 flex-wrap">
                          {ticket.department && (
                            <span className={`px-1.5 py-0.5 text-xs rounded border ${getDepartmentColor(ticket.department)}`}>
                              {getDepartmentLabel(ticket.department)}
                            </span>
                          )}
                          {ticket.status && (
                            <span className={`px-1.5 py-0.5 text-xs rounded border ${getStatusColor(ticket.status)}`}>
                              {ticket.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                  })}
                </div>
              )
            })()
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {roomId ? (
          <ErrorBoundary errorBoundaryName="ChatRoom">
            <ChatRoom 
              roomId={roomId} 
              roomName={roomName}
            />
          </ErrorBoundary>
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

