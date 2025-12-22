export type ActivityEventType =
  | 'ticket.created'
  | 'ticket.status.changed'
  | 'ticket.assigned'
  | 'room.created'
  | 'message.posted'

export interface ActivityEvent {
  id: string // Unique ID (source table ID + prefix)
  type: ActivityEventType
  timestamp: string // ISO string for JSON serialization
  actor: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  target: {
    id: string // roomId, ticketId, messageId
    title?: string | null // Room/ticket title
    type?: string | null // Room type, ticket department, etc.
  }
  metadata: {
    // Event-specific data
    [key: string]: any
  }
  source: 'audit' | 'room' | 'message' // Source table for debugging
  sourceId: string // Original record ID
}

