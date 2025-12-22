import { prisma } from './prisma'

export type AuditAction =
  | 'user.ban'
  | 'user.unban'
  | 'room.delete'
  | 'member.remove'
  | 'ownership.transfer'
  | 'room.edit'
  | 'message.delete'
  | 'ticket.status.change'
  | 'ticket.assign'

export interface AuditMetadata {
  reason?: string
  oldValue?: any
  newValue?: any
  [key: string]: any
}

/**
 * Log an admin/moderation action
 */
export async function logAction(
  action: AuditAction,
  actorId: string,
  targetType: string | null,
  targetId: string | null,
  metadata?: AuditMetadata
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        actorId,
        targetType,
        targetId,
        metadata: metadata || {},
      },
    })
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to log audit action:', error)
  }
}

