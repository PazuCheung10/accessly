import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { getTicketAIProvider } from './providers'
import { AIInsights, AnonymizedMessage, RoomContext } from './types'

/**
 * Service for fetching ticket data and generating AI insights
 * Handles data fetching, anonymization, and provider delegation
 */
export class TicketAIService {
  /**
   * Fetch room context for AI processing
   */
  async getRoomContext(roomId: string): Promise<RoomContext | null> {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        ticketDepartment: true,
        createdAt: true,
      },
    })

    if (!room) return null

    return {
      id: room.id,
      title: room.title,
      description: room.description,
      status: room.status,
      ticketDepartment: room.ticketDepartment,
      createdAt: room.createdAt,
    }
  }

  /**
   * Fetch and anonymize messages for a room
   * Returns messages in chronological order (oldest first)
   */
  async getAnonymizedMessages(roomId: string, limit: number = 20): Promise<AnonymizedMessage[]> {
    // Fetch messages (newest first)
    const messages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    })

    // Reverse to chronological order (oldest first)
    const chronologicalMessages = [...messages].reverse()

    // Anonymize messages: replace names/emails with role labels
    return chronologicalMessages.map((msg) => {
      let roleLabel: 'Customer' | 'Support Agent' = 'Customer'
      if (msg.user?.role === Role.ADMIN) {
        roleLabel = 'Support Agent'
      }

      return {
        role: roleLabel,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
      }
    })
  }

  /**
   * Generate AI insights for a ticket room
   * Uses the configured provider (fake or openai)
   */
  async generateInsights(roomId: string): Promise<{
    insights: AIInsights
    provider: string
  }> {
    const provider = getTicketAIProvider()
    
    // Fetch room context
    const roomContext = await this.getRoomContext(roomId)
    if (!roomContext) {
      throw new Error('Room not found')
    }

    // Fetch and anonymize messages
    const messages = await this.getAnonymizedMessages(roomId)

    // Generate insights using provider
    const insights = await provider.generate(roomContext, messages)

    return {
      insights,
      provider: provider.name,
    }
  }
}

