import { TicketAIProvider } from '../provider'
import { AIInsights, AnonymizedMessage, RoomContext } from '../types'

/**
 * Fake AI provider using deterministic keyword-based heuristics
 * No external API calls, suitable for development/testing
 */
export class FakeTicketAIProvider implements TicketAIProvider {
  readonly name = 'fake'

  async generate(
    room: RoomContext,
    messages: AnonymizedMessage[]
  ): Promise<AIInsights> {
    // Deterministic mock logic based on keywords and message patterns
    const messageCount = messages.length
    const lastMessage = messages[messages.length - 1]
    const isCustomerMessage = lastMessage?.role === 'Customer'
    
    // Analyze message content for keywords
    const allContent = messages.map(m => m.content.toLowerCase()).join(' ')
    const hasUrgentKeywords = /urgent|asap|immediately|critical|emergency|down|broken|not working|error|bug|crash/i.test(allContent)
    const hasAngryKeywords = /angry|frustrated|disappointed|unacceptable|terrible|awful|horrible|worst|hate/i.test(allContent)
    const hasSecurityKeywords = /security|hack|breach|unauthorized|stolen|compromised|password|account/i.test(allContent)
    const hasBillingKeywords = /refund|charge|billing|payment|invoice|credit|debit|money|cost|price|fee/i.test(allContent)
    const hasLoginKeywords = /login|password|account|access|sign in|authenticate|locked out/i.test(allContent)
    
    // Determine if escalation is needed
    const needsEscalation = 
      hasUrgentKeywords ||
      hasAngryKeywords ||
      hasSecurityKeywords ||
      (room.status === 'OPEN' && messageCount > 3 && isCustomerMessage) ||
      (messageCount > 5 && isCustomerMessage)

    // Generate summary
    let summary = ''
    if (messageCount === 0) {
      summary = `New ${room.ticketDepartment || 'General'} support ticket: "${room.title}". No messages yet.`
    } else {
      const firstMessage = messages[0]
      const customerMessages = messages.filter(m => m.role === 'Customer')
      const agentMessages = messages.filter(m => m.role === 'Support Agent')
      
      summary = `Customer reported: "${firstMessage.content.substring(0, 100)}${firstMessage.content.length > 100 ? '...' : ''}"`
      
      if (hasUrgentKeywords) summary += ' Customer indicates urgency.'
      if (hasAngryKeywords) summary += ' Customer expresses frustration.'
      if (hasSecurityKeywords) summary += ' Security-related concern detected.'
      if (hasBillingKeywords) summary += ' Billing/payment issue mentioned.'
      if (hasLoginKeywords) summary += ' Account access issue reported.'
      
      summary += ` ${customerMessages.length} customer message(s), ${agentMessages.length} agent response(s).`
      
      if (room.status) {
        summary += ` Current status: ${room.status}.`
      }
      
      if (isCustomerMessage && agentMessages.length === 0) {
        summary += ' Awaiting initial agent response.'
      } else if (isCustomerMessage && agentMessages.length > 0) {
        summary += ' Customer is waiting for follow-up.'
      }
    }

    // Generate contextual suggestions
    const suggestions: string[] = []
    
    if (hasBillingKeywords) {
      suggestions.push(`I understand your concern about the billing issue. Let me review your account and payment history to resolve this for you.`)
      suggestions.push(`I've checked your account and I can help you with this billing matter. Would you like me to process a refund or adjust the charges?`)
    } else if (hasLoginKeywords) {
      suggestions.push(`I can help you regain access to your account. Let me verify your identity and reset your credentials securely.`)
      suggestions.push(`I understand you're having trouble logging in. I'll help you reset your password and secure your account.`)
    } else if (hasSecurityKeywords) {
      suggestions.push(`This is a security concern that requires immediate attention. I'm escalating this to our security team for review.`)
      suggestions.push(`I take security issues seriously. Let me investigate this immediately and take appropriate action to protect your account.`)
    } else if (hasUrgentKeywords || hasAngryKeywords) {
      suggestions.push(`I understand this is urgent and I apologize for any inconvenience. Let me prioritize this and get you a resolution as quickly as possible.`)
      suggestions.push(`I sincerely apologize for the frustration this has caused. I'm personally looking into this right now and will provide an update shortly.`)
    } else {
      suggestions.push(`Thank you for contacting us about "${room.title}". I understand your concern and I'm here to help. Let me investigate this issue for you.`)
      suggestions.push(`I've reviewed your ticket and I can help you resolve this. Based on the information provided, I recommend the following steps...`)
    }
    
    suggestions.push(`I appreciate your patience. I'm currently looking into this matter and will provide you with an update shortly.`)

    // Limit to 3-5 suggestions
    const finalSuggestions = suggestions.slice(0, 5)

    // Determine escalation
    let escalation: { recommended: boolean; department?: string; reason?: string }
    if (needsEscalation) {
      let reason = ''
      if (hasSecurityKeywords) {
        reason = 'Security-related issue detected. Requires specialized security team review.'
      } else if (hasUrgentKeywords) {
        reason = 'Customer indicates urgent issue. Consider escalating for faster resolution.'
      } else if (hasAngryKeywords) {
        reason = 'Customer expresses frustration. Escalation may help de-escalate the situation.'
      } else if (messageCount > 5 && isCustomerMessage) {
        reason = 'Multiple customer messages without resolution. Consider escalating to specialized team.'
      } else {
        reason = 'Complex issue requiring specialized attention.'
      }

      escalation = {
        recommended: true,
        department: room.ticketDepartment || 'GENERAL',
        reason,
      }
    } else {
      escalation = {
        recommended: false,
      }
    }

    return {
      summary,
      suggestions: finalSuggestions,
      escalation,
    }
  }
}

