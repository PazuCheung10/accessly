/**
 * Centralized structured logger for Phase 1 Ops
 * Provides consistent logging format with context
 */

type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  routeName?: string
  userId?: string
  roomId?: string
  requestId?: string
  socketId?: string
  [key: string]: any
}

function formatLog(level: LogLevel, context: LogContext, messageOrObject: string | object): string {
  const timestamp = new Date().toISOString()
  const message = typeof messageOrObject === 'string' ? messageOrObject : JSON.stringify(messageOrObject)
  
  const logEntry = {
    timestamp,
    level,
    ...context,
    message,
  }
  
  return JSON.stringify(logEntry)
}

export const logger = {
  info(context: LogContext, messageOrObject: string | object): void {
    const formatted = formatLog('info', context, messageOrObject)
    console.log(formatted)
  },

  warn(context: LogContext, messageOrObject: string | object): void {
    const formatted = formatLog('warn', context, messageOrObject)
    console.warn(formatted)
  },

  error(context: LogContext, errorOrMessage: Error | string, extraContext?: LogContext): void {
    const mergedContext = { ...context, ...extraContext }
    
    if (errorOrMessage instanceof Error) {
      mergedContext.errorName = errorOrMessage.name
      mergedContext.errorMessage = errorOrMessage.message
      if (errorOrMessage.stack) {
        mergedContext.stack = errorOrMessage.stack
      }
    } else {
      mergedContext.message = errorOrMessage
    }
    
    const formatted = formatLog('error', mergedContext, errorOrMessage instanceof Error ? errorOrMessage.message : errorOrMessage)
    console.error(formatted)
  },
}

