import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  roomId: string
  userId: string
  content: string
  parentMessageId?: string | null
  createdAt: string
  editedAt?: string | null
  deletedAt?: string | null
  reactions?: Record<string, string[]> | null
  user: { id: string; name: string | null; image: string | null } | null // Allow null for system messages
  replies?: Message[] // For hierarchical structure
}

type RoomState = {
  messages: Message[]
  cursor: string | null        // cursor for OLDER messages (points to oldest id we have)
  lastMessageId: string | null // newest id we have (for /after polling)
  scrollTop: number | null     // last known scrollTop when leaving room
  lastFetchedAt: number
}

type ChatStore = {
  rooms: Record<string, RoomState>
  expandedThreads: Record<string, string[]> // roomId -> array of expanded message IDs (for persistence)
  setRoom: (roomId: string, patch: Partial<RoomState>) => void
  getRoom: (roomId: string) => RoomState | undefined
  upsertMessages: (roomId: string, msgs: Message[], { asPrepend }?: { asPrepend?: boolean }) => void
  toggleThread: (roomId: string, messageId: string) => void
  isThreadExpanded: (roomId: string, messageId: string) => boolean
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      rooms: {},
      expandedThreads: {},

      getRoom: (roomId) => get().rooms[roomId],

      setRoom: (roomId, patch) =>
        set(s => ({ rooms: { ...s.rooms, [roomId]: { ...(s.rooms[roomId] ?? {
          messages: [], cursor: null, lastMessageId: null, scrollTop: null, lastFetchedAt: 0
        }), ...patch } } })),

      upsertMessages: (roomId, msgs, { asPrepend } = {}) =>
        set(s => {
          // DEBUG: Log what comes in (development only)
          if (process.env.NODE_ENV !== 'production') {
            console.log('DEBUG upsertMessages', {
              roomId,
              newCount: msgs.length,
              newIds: msgs.map(m => m.id),
              hasExistingRoom: !!s.rooms[roomId],
              existingCount: s.rooms[roomId]?.messages?.length ?? 0,
            })
          }

          const r = s.rooms[roomId] ?? { messages: [], cursor: null, lastMessageId: null, scrollTop: null, lastFetchedAt: 0 }
          const existing = new Map(r.messages.map(m => [m.id, m]))
          for (const m of msgs) existing.set(m.id, m)
          let merged = Array.from(existing.values()).sort((a,b)=> new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          // If we're prepending older messages, merged is already sorted; nothing more to do.
          const newest = merged.length ? merged[merged.length-1].id : r.lastMessageId
          const oldest = merged.length ? merged[0].id : r.cursor
          
          const next = {
            rooms: {
              ...s.rooms,
              [roomId]: { ...r, messages: merged, lastMessageId: newest, cursor: oldest, lastFetchedAt: Date.now() }
            }
          }

          // DEBUG: Log what will be stored (development only)
          if (process.env.NODE_ENV !== 'production') {
            const nextRoom = next.rooms[roomId]
            console.log('DEBUG upsertMessages after merge', {
              roomId,
              finalCount: nextRoom?.messages?.length ?? 0,
              finalIds: (nextRoom?.messages ?? []).map(m => m.id),
            })
          }

          return next
        }),

      toggleThread: (roomId, messageId) =>
        set(s => {
          const threads = s.expandedThreads[roomId] ?? []
          const threadSet = new Set(threads)
          if (threadSet.has(messageId)) {
            threadSet.delete(messageId)
          } else {
            threadSet.add(messageId)
          }
          return {
            expandedThreads: {
              ...s.expandedThreads,
              [roomId]: Array.from(threadSet)
            }
          }
        }),

      isThreadExpanded: (roomId, messageId) => {
        const threads = get().expandedThreads[roomId]
        return threads ? threads.includes(messageId) : false
      }
    }),
    { name: 'accessly-chat-store' } // localStorage key
  )
)

