import { ActivityEvent, ActivityEventType } from './types'
import { AuditLog, Room, Message, User } from '@prisma/client'

type AuditLogWithActor = AuditLog & {
  actor: Pick<User, 'id' | 'name' | 'email' | 'image'>
}

type RoomWithCreator = Room & {
  creator: Pick<User, 'id' | 'name' | 'email' | 'image'> | null
}

type MessageWithUserAndRoom = Message & {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>
  room: Pick<Room, 'id' | 'title' | 'type'> | null
}

/**
 * Map audit action to activity event type
 */
function mapAuditActionToEventType(action: string): ActivityEventType | null {
  switch (action) {
    case 'ticket.status.change':
      return 'ticket.status.changed'
    case 'ticket.assign':
      return 'ticket.assigned'
    default:
      return null // Filter out unmapped actions
  }
}

/**
 * Normalize audit log to activity event
 */
export function normalizeAuditLog(log: AuditLogWithActor): ActivityEvent | null {
  const eventType = mapAuditActionToEventType(log.action)
  if (!eventType) {
    return null
  }

  const metadata = (log.metadata as Record<string, any>) || {}

  return {
    id: `audit-${log.id}`,
    type: eventType,
    timestamp: log.createdAt.toISOString(),
    actor: {
      id: log.actor.id,
      name: log.actor.name,
      email: log.actor.email,
      image: log.actor.image,
    },
    target: {
      id: log.targetId || '',
      title: metadata.ticketTitle || null,
      type: null,
    },
    metadata,
    source: 'audit',
    sourceId: log.id,
  }
}

/**
 * Normalize room to activity event (ticket created or room created)
 */
export function normalizeRoom(
  room: RoomWithCreator,
  eventType: 'ticket.created' | 'room.created'
): ActivityEvent {
  const metadata: Record<string, any> = {
    roomId: room.id,
    roomTitle: room.title,
  }

  if (room.type === 'TICKET') {
    metadata.ticketDepartment = room.ticketDepartment
    metadata.status = room.status
  } else {
    metadata.roomType = room.type
    metadata.isPrivate = room.isPrivate
  }

  return {
    id: `room-${room.id}`,
    type: eventType,
    timestamp: room.createdAt.toISOString(),
    actor: room.creator
      ? {
          id: room.creator.id,
          name: room.creator.name,
          email: room.creator.email,
          image: room.creator.image,
        }
      : {
          id: '',
          name: null,
          email: null,
          image: null,
        },
    target: {
      id: room.id,
      title: room.title,
      type: room.type,
    },
    metadata,
    source: 'room',
    sourceId: room.id,
  }
}

/**
 * Normalize message to activity event
 */
export function normalizeMessage(message: MessageWithUserAndRoom): ActivityEvent {
  return {
    id: `message-${message.id}`,
    type: 'message.posted',
    timestamp: message.createdAt.toISOString(),
    actor: {
      id: message.user.id,
      name: message.user.name,
      email: message.user.email,
      image: message.user.image,
    },
    target: {
      id: message.roomId,
      title: message.room?.title || null,
      type: message.room?.type || null,
    },
    metadata: {
      messageId: message.id,
      roomId: message.roomId,
      content: message.content.substring(0, 100), // Truncate for preview
      isThreadReply: message.parentMessageId !== null,
    },
    source: 'message',
    sourceId: message.id,
  }
}

