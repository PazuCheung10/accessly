import { z } from 'zod'

/**
 * Schema for message input validation
 */
export const MessageInput = z.object({
  roomId: z.string().cuid(),
  content: z.string().min(1).max(5000),
  parentMessageId: z.string().cuid().optional().nullable(),
})

/**
 * Schema for pagination parameters
 */
export const Pagination = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
})

export const RoomInput = z.object({
  name: z.string().min(1).max(100).regex(/^#?[a-zA-Z0-9_-]+$/, 'Room name must be alphanumeric with optional # prefix'),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).default([]),
  type: z.enum(['PUBLIC', 'PRIVATE', 'DM']).default('PUBLIC'),
  isPrivate: z.boolean().default(false),
})

export type MessageInputType = z.infer<typeof MessageInput>
export type PaginationType = z.infer<typeof Pagination>
export type RoomInputType = z.infer<typeof RoomInput>