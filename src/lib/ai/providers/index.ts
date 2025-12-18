import { TicketAIProvider } from '../provider'
import { FakeTicketAIProvider } from './fake'
import { OpenAITicketAIProvider } from './openai'

/**
 * Get the configured AI provider based on TICKET_AI_PROVIDER env var
 * Defaults to 'fake' if not set
 */
export function getTicketAIProvider(): TicketAIProvider {
  const providerName = (process.env.TICKET_AI_PROVIDER || 'fake').toLowerCase()

  switch (providerName) {
    case 'openai':
      return new OpenAITicketAIProvider()
    case 'fake':
    default:
      return new FakeTicketAIProvider()
  }
}

