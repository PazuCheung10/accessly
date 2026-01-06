/**
 * AI Insights types for ticket assistant
 */
export interface AIInsights {
  summary: string
  summarySource: 'deterministic' | 'ai'
  suggestions: string[]
  escalation: {
    recommended: boolean
    severity?: 'HIGH' | 'MEDIUM' | 'LOW'
    department?: string
    reason?: string
  }
}

/**
 * Anonymized message for AI processing
 */
export interface AnonymizedMessage {
  role: 'Customer' | 'Support Agent'
  content: string
  timestamp: string
}

/**
 * Room context for AI processing
 */
export interface RoomContext {
  id: string
  title: string
  description: string | null
  status: string | null
  ticketDepartment: string | null
  createdAt: Date
}

/**
 * Message with ID for tracking what's been summarized
 */
export interface AnonymizedMessageWithId extends AnonymizedMessage {
  id: string
}

