import { z } from 'zod'

/**
 * Schema for message input validation
 */
export const MessageInput = z.object({
  roomId: z.string().cuid(),
  content: z.string().min(1).max(5000),
})

/**
 * Schema for pagination parameters
 */
export const Pagination = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
})

export type MessageInputType = z.infer<typeof MessageInput>
export type PaginationType = z.infer<typeof Pagination>