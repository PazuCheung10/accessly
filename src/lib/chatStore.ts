import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  roomId: string
  userId: string
  content: string
  createdAt: string
  user: { id: string; name: string | null; image: string | null }
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
  setRoom: (roomId: string, patch: Partial<RoomState>) => void
  getRoom: (roomId: string) => RoomState | undefined
  upsertMessages: (roomId: string, msgs: Message[], { asPrepend }?: { asPrepend?: boolean }) => void
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      rooms: {},

      getRoom: (roomId) => get().rooms[roomId],

      setRoom: (roomId, patch) =>
        set(s => ({ rooms: { ...s.rooms, [roomId]: { ...(s.rooms[roomId] ?? {
          messages: [], cursor: null, lastMessageId: null, scrollTop: null, lastFetchedAt: 0
        }), ...patch } } })),

      upsertMessages: (roomId, msgs, { asPrepend } = {}) =>
        set(s => {
          const r = s.rooms[roomId] ?? { messages: [], cursor: null, lastMessageId: null, scrollTop: null, lastFetchedAt: 0 }
          const existing = new Map(r.messages.map(m => [m.id, m]))
          for (const m of msgs) existing.set(m.id, m)
          let merged = Array.from(existing.values()).sort((a,b)=> new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          // If we're prepending older messages, merged is already sorted; nothing more to do.
          const newest = merged.length ? merged[merged.length-1].id : r.lastMessageId
          const oldest = merged.length ? merged[0].id : r.cursor
          return {
            rooms: {
              ...s.rooms,
              [roomId]: { ...r, messages: merged, lastMessageId: newest, cursor: oldest, lastFetchedAt: Date.now() }
            }
          }
        })
    }),
    { name: 'accessly-chat-store' } // localStorage key
  )
)

