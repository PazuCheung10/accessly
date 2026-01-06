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

    // Generate summary - more tailored and contextual
    let summary = ''
    if (messageCount === 0) {
      summary = `New ${room.ticketDepartment || 'General'} support ticket: "${room.title}". No messages yet.`
    } else {
      const firstMessage = messages[0]
      const customerMessages = messages.filter(m => m.role === 'Customer')
      const agentMessages = messages.filter(m => m.role === 'Support Agent')
      
      // Extract key details from first message
      const firstMessagePreview = firstMessage.content.length > 120 
        ? firstMessage.content.substring(0, 120) + '...'
        : firstMessage.content
      
      // Build contextual summary based on department
      const dept = room.ticketDepartment || 'GENERAL'
      if (dept === 'IT_SUPPORT') {
        summary = `IT Support ticket: Customer experiencing "${firstMessagePreview}". `
      } else if (dept === 'BILLING') {
        summary = `Billing inquiry: Customer has questions about "${firstMessagePreview}". `
      } else if (dept === 'PRODUCT') {
        summary = `Product feedback: Customer requesting "${firstMessagePreview}". `
      } else {
        summary = `Support request: Customer reported "${firstMessagePreview}". `
      }
      
      // Add emotional/urgency context
      if (hasUrgentKeywords) summary += 'Customer indicates this is urgent and requires immediate attention. '
      if (hasAngryKeywords) summary += 'Customer expresses frustration and dissatisfaction. '
      if (hasSecurityKeywords) summary += 'Security-related concern detected - requires priority handling. '
      if (hasBillingKeywords && dept !== 'BILLING') summary += 'Billing/payment issue mentioned. '
      if (hasLoginKeywords && dept !== 'IT_SUPPORT') summary += 'Account access issue reported. '
      
      // Add conversation flow context
      summary += `Conversation includes ${customerMessages.length} customer message(s) and ${agentMessages.length} agent response(s). `
      
      if (room.status) {
        summary += `Ticket status: ${room.status}. `
      }
      
      // Add next action context
      if (isCustomerMessage && agentMessages.length === 0) {
        summary += 'Awaiting initial agent response - customer needs assistance.'
      } else if (isCustomerMessage && agentMessages.length > 0) {
        summary += 'Customer is waiting for follow-up after previous agent response.'
      } else if (agentMessages.length > 0 && !isCustomerMessage) {
        summary += 'Agent has responded - monitoring for customer reply.'
      }
    }

    // Generate contextual suggestions - more tailored to department and situation
    const suggestions: string[] = []
    const dept = room.ticketDepartment || 'GENERAL'
    
    // Department-specific suggestions
    if (dept === 'IT_SUPPORT') {
      if (hasLoginKeywords) {
        suggestions.push(`I can help you regain access to your account. Let me verify your identity and reset your credentials securely.`)
        suggestions.push(`I understand you're having trouble logging in. I'll help you reset your password and secure your account. Please check your email for the reset link.`)
        suggestions.push(`I've initiated a password reset for your account. You should receive an email with instructions within the next few minutes. If you don't see it, please check your spam folder.`)
      } else if (hasUrgentKeywords) {
        suggestions.push(`I understand this is urgent and affecting your ability to work. Let me prioritize this and get you a resolution as quickly as possible.`)
        suggestions.push(`I've escalated this to our technical team for immediate attention. I'll provide you with an update within the next hour.`)
      } else {
        suggestions.push(`Thank you for reporting this technical issue. I'm investigating the problem and will work to resolve it for you.`)
        suggestions.push(`I've reviewed the issue you're experiencing. Let me check our system logs and get back to you with a solution shortly.`)
        suggestions.push(`I understand the frustration this technical issue is causing. I'm working on a fix and will update you as soon as I have more information.`)
      }
    } else if (dept === 'BILLING') {
      if (hasBillingKeywords) {
        suggestions.push(`I understand your concern about the billing issue. Let me review your account and payment history to resolve this for you.`)
        suggestions.push(`I've checked your account and I can help you with this billing matter. Would you like me to process a refund or adjust the charges?`)
        suggestions.push(`I've reviewed your billing statement and found the discrepancy. I'll process a credit to your account and send you an updated invoice.`)
      } else {
        suggestions.push(`Thank you for reaching out about your billing question. Let me review your account details and get back to you with a clear explanation.`)
        suggestions.push(`I've examined your payment history and can clarify the charges for you. I'll send a detailed breakdown via email.`)
      }
    } else if (dept === 'PRODUCT') {
      suggestions.push(`Thank you for your product feedback. I've logged your feature request and will share it with our product team for consideration.`)
      suggestions.push(`I appreciate you taking the time to share this idea. Our product team reviews all feature requests, and I'll make sure yours is included in the next planning cycle.`)
      suggestions.push(`This is a great suggestion! I've added it to our product roadmap for review. I'll keep you updated on any progress.`)
    } else {
      // GENERAL department
      if (hasSecurityKeywords) {
        suggestions.push(`This is a security concern that requires immediate attention. I'm escalating this to our security team for review.`)
        suggestions.push(`I take security issues seriously. Let me investigate this immediately and take appropriate action to protect your account.`)
      } else if (hasUrgentKeywords || hasAngryKeywords) {
        suggestions.push(`I understand this is urgent and I apologize for any inconvenience. Let me prioritize this and get you a resolution as quickly as possible.`)
        suggestions.push(`I sincerely apologize for the frustration this has caused. I'm personally looking into this right now and will provide an update shortly.`)
      } else {
        suggestions.push(`Thank you for contacting us about "${room.title}". I understand your concern and I'm here to help. Let me investigate this issue for you.`)
        suggestions.push(`I've reviewed your ticket and I can help you resolve this. Based on the information provided, I recommend the following steps...`)
      }
    }
    
    // Add a general follow-up suggestion if we have space
    if (suggestions.length < 4) {
      suggestions.push(`I appreciate your patience. I'm currently looking into this matter and will provide you with an update shortly.`)
    }

    // Limit to 3-5 suggestions
    const finalSuggestions = suggestions.slice(0, 5)

    // Determine escalation with severity
    let escalation: { recommended: boolean; severity?: 'HIGH' | 'MEDIUM' | 'LOW'; department?: string; reason?: string }
    if (needsEscalation) {
      let reason = ''
      let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
      
      if (hasSecurityKeywords) {
        reason = 'Security-related issue detected. Requires specialized security team review.'
        severity = 'HIGH'
      } else if (hasUrgentKeywords) {
        reason = 'Customer indicates urgent issue. Consider escalating for faster resolution.'
        severity = 'HIGH'
      } else if (hasAngryKeywords) {
        reason = 'Customer expresses frustration. Escalation may help de-escalate the situation.'
        severity = 'MEDIUM'
      } else if (messageCount > 5 && isCustomerMessage) {
        reason = 'Multiple customer messages without resolution. Consider escalating to specialized team.'
        severity = 'MEDIUM'
      } else {
        reason = 'Complex issue requiring specialized attention.'
        severity = 'LOW'
      }

      escalation = {
        recommended: true,
        severity,
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
      summarySource: 'deterministic',
      suggestions: finalSuggestions,
      escalation,
    }
  }

  /**
   * Incremental summarization: merge new messages with previous summary
   * Simulates how a real LLM would update a summary with new information
   */
  async generateIncremental(
    room: RoomContext,
    previousSummary: string,
    previousInsights: AIInsights,
    newMessages: AnonymizedMessage[]
  ): Promise<AIInsights> {
    if (newMessages.length === 0) {
      // No new messages, return previous insights unchanged
      return previousInsights
    }

    const newMessageCount = newMessages.length
    const lastNewMessage = newMessages[newMessages.length - 1]
    const isCustomerMessage = lastNewMessage?.role === 'Customer'
    
    // Analyze NEW messages for keywords
    const newContent = newMessages.map(m => m.content.toLowerCase()).join(' ')
    const hasNewUrgentKeywords = /urgent|asap|immediately|critical|emergency|down|broken|not working|error|bug|crash/i.test(newContent)
    const hasNewAngryKeywords = /angry|frustrated|disappointed|unacceptable|terrible|awful|horrible|worst|hate/i.test(newContent)
    const hasNewSecurityKeywords = /security|hack|breach|unauthorized|stolen|compromised|password|account/i.test(newContent)
    const hasNewBillingKeywords = /refund|charge|billing|payment|invoice|credit|debit|money|cost|price|fee/i.test(newContent)
    const hasNewLoginKeywords = /login|password|account|access|sign in|authenticate|locked out/i.test(newContent)

    // Count message types in new messages
    const newCustomerMessages = newMessages.filter(m => m.role === 'Customer')
    const newAgentMessages = newMessages.filter(m => m.role === 'Support Agent')

    // Merge summary: previous summary + new information (more natural flow)
    let mergedSummary = previousSummary.trim()
    
    // Add update indicator with context
    if (newMessageCount === 1) {
      mergedSummary += ` [Update: 1 new message received`
    } else {
      mergedSummary += ` [Update: ${newMessageCount} new messages received`
    }

    // Add new information based on new messages (more contextual)
    if (hasNewUrgentKeywords) {
      mergedSummary += ' - customer indicates urgency'
    }
    if (hasNewAngryKeywords) {
      mergedSummary += ' - customer expresses increased frustration'
    }
    if (hasNewSecurityKeywords) {
      mergedSummary += ' - security-related concern mentioned'
    }
    if (hasNewBillingKeywords) {
      mergedSummary += ' - billing/payment issue discussed'
    }
    if (hasNewLoginKeywords) {
      mergedSummary += ' - account access issue mentioned'
    }

    // Update message counts
    if (newCustomerMessages.length > 0 && newAgentMessages.length > 0) {
      mergedSummary += ` - ${newCustomerMessages.length} customer message(s) and ${newAgentMessages.length} agent response(s)`
    } else if (newCustomerMessages.length > 0) {
      mergedSummary += ` - ${newCustomerMessages.length} customer message(s)`
    } else if (newAgentMessages.length > 0) {
      mergedSummary += ` - ${newAgentMessages.length} agent response(s)`
    }

    // Update status based on latest message
    if (isCustomerMessage && newAgentMessages.length === 0) {
      mergedSummary += ' - customer awaiting response'
    } else if (newAgentMessages.length > 0) {
      mergedSummary += ' - agent has responded'
    }

    mergedSummary += ']'

    // Update suggestions based on new context - more tailored
    let suggestions: string[] = []
    const dept = room.ticketDepartment || 'GENERAL'
    
    if (hasNewBillingKeywords || (dept === 'BILLING' && newCustomerMessages.length > 0)) {
      suggestions.push(`I understand your concern about the billing issue. Let me review your account and payment history to resolve this for you.`)
      suggestions.push(`I've checked your account and I can help you with this billing matter. Would you like me to process a refund or adjust the charges?`)
    } else if (hasNewLoginKeywords || (dept === 'IT_SUPPORT' && newCustomerMessages.length > 0)) {
      suggestions.push(`I can help you regain access to your account. Let me verify your identity and reset your credentials securely.`)
      suggestions.push(`I understand you're having trouble logging in. I'll help you reset your password and secure your account.`)
    } else if (hasNewSecurityKeywords) {
      suggestions.push(`This is a security concern that requires immediate attention. I'm escalating this to our security team for review.`)
      suggestions.push(`I take security issues seriously. Let me investigate this immediately and take appropriate action to protect your account.`)
    } else if (hasNewUrgentKeywords || hasNewAngryKeywords) {
      suggestions.push(`I understand this is urgent and I apologize for any inconvenience. Let me prioritize this and get you a resolution as quickly as possible.`)
      suggestions.push(`I sincerely apologize for the frustration this has caused. I'm personally looking into this right now and will provide an update shortly.`)
    } else {
      // Keep previous suggestions if no new keywords, but add a contextual one
      suggestions = [...previousInsights.suggestions]
      if (isCustomerMessage) {
        if (dept === 'PRODUCT') {
          suggestions.unshift(`Thank you for the additional feedback. I've updated the feature request with your latest input.`)
        } else {
          suggestions.unshift(`Thank you for the update. I'm reviewing the latest information and will respond shortly.`)
        }
      }
    }

    // Limit suggestions
    const finalSuggestions = suggestions.slice(0, 5)

    // Update escalation: check if new messages warrant escalation
    const previousEscalationRecommended = previousInsights.escalation.recommended
    const newMessagesWarrantEscalation = 
      hasNewUrgentKeywords ||
      hasNewAngryKeywords ||
      hasNewSecurityKeywords ||
      (room.status === 'OPEN' && newCustomerMessages.length > 2) ||
      (newCustomerMessages.length > 3)

    let escalation: { recommended: boolean; severity?: 'HIGH' | 'MEDIUM' | 'LOW'; department?: string; reason?: string }
    
    if (newMessagesWarrantEscalation) {
      // New messages warrant escalation
      let reason = ''
      let severity: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'
      
      if (hasNewSecurityKeywords) {
        reason = 'Security-related issue detected in recent messages. Requires specialized security team review.'
        severity = 'HIGH'
      } else if (hasNewUrgentKeywords) {
        reason = 'Customer indicates urgent issue in recent messages. Consider escalating for faster resolution.'
        severity = 'HIGH'
      } else if (hasNewAngryKeywords) {
        reason = 'Customer expresses increased frustration in recent messages. Escalation may help de-escalate the situation.'
        severity = 'MEDIUM'
      } else if (newCustomerMessages.length > 3) {
        reason = 'Multiple new customer messages without resolution. Consider escalating to specialized team.'
        severity = 'MEDIUM'
      } else {
        reason = 'Recent messages indicate complex issue requiring specialized attention.'
        severity = 'LOW'
      }

      escalation = {
        recommended: true,
        severity,
        department: room.ticketDepartment || 'GENERAL',
        reason,
      }
    } else if (previousEscalationRecommended) {
      // Keep previous escalation if still relevant
      escalation = previousInsights.escalation
    } else {
      // No escalation needed
      escalation = {
        recommended: false,
      }
    }

    return {
      summary: mergedSummary,
      summarySource: 'deterministic',
      suggestions: finalSuggestions,
      escalation,
    }
  }
}

