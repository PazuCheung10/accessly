/**
 * AI Insights types for ticket assistant
 */
export interface AIInsights {
  summary: string
  suggestions: string[]
  escalation: {
    recommended: boolean
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

