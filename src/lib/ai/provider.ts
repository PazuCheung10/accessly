import { AIInsights, AnonymizedMessage, RoomContext } from './types'

/**
 * Provider interface for AI ticket insights
 * Implementations: FakeTicketAIProvider, OpenAITicketAIProvider
 */
export interface TicketAIProvider {
  /**
   * Generate AI insights for a ticket room
   * @param roomContext - Room metadata
   * @param messages - Anonymized messages in chronological order
   * @returns AI insights (summary, suggestions, escalation)
   */
  generate(
    roomContext: RoomContext,
    messages: AnonymizedMessage[]
  ): Promise<AIInsights>

  /**
   * Provider identifier (for logging/debugging)
   */
  readonly name: string
}

