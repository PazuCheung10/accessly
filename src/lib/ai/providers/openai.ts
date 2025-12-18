import { TicketAIProvider } from '../provider'
import { AIInsights, AnonymizedMessage, RoomContext } from '../types'

/**
 * OpenAI provider stub (not implemented yet)
 * Will be implemented when OPENAI_API_KEY is configured
 */
export class OpenAITicketAIProvider implements TicketAIProvider {
  readonly name = 'openai'

  async generate(
    room: RoomContext,
    messages: AnonymizedMessage[]
  ): Promise<AIInsights> {
    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is required for OpenAI provider'
      )
    }

    // TODO: Implement OpenAI API call
    // 1. Build prompt with room context and anonymized messages
    // 2. Call OpenAI API (gpt-4 or gpt-3.5-turbo)
    // 3. Parse response into AIInsights format
    // 4. Handle rate limiting and errors
    
    throw new Error(
      'OpenAI provider is not yet implemented. Use TICKET_AI_PROVIDER=fake for now.'
    )
  }
}

