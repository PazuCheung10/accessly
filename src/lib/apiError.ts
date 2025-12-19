/**
 * Shared API error handler for Phase 1 Ops
 * Provides consistent error logging and response format
 */

import { logger } from './logger'
import { getRequestId } from './requestLogger'

interface ErrorContext {
  routeName: string
  userId?: string
  roomId?: string
  requestId?: string
  [key: string]: any
}

/**
 * Handle API errors with logging and Sentry reporting
 */
export async function handleApiError(
  error: unknown,
  context: ErrorContext,
  request?: Request
): Promise<Response> {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorName = error instanceof Error ? error.name : 'UnknownError'
  
  // Extract requestId from async context (set by request logger) or from context
  const requestId = getRequestId() || context.requestId
  
  // Log error with context (include requestId if available)
  logger.error(
    { ...context, requestId },
    error instanceof Error ? error : new Error(errorMessage),
    {
      errorName,
      method: request?.method,
      url: request?.url,
    }
  )

  // Report to Sentry if configured
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
    try {
      // Dynamic import to avoid loading Sentry if not configured
      const Sentry = await import('@sentry/nextjs')
      const sentryContext = { ...context }
      if (requestId) {
        sentryContext.requestId = requestId
      }
      
      if (error instanceof Error) {
        Sentry.captureException(error, {
          tags: {
            route: context.routeName,
            requestId: requestId || 'unknown',
          },
          extra: sentryContext,
        })
      } else {
        Sentry.captureMessage(errorMessage, {
          level: 'error',
          tags: {
            route: context.routeName,
            requestId: requestId || 'unknown',
          },
          extra: sentryContext,
        })
      }
    } catch (sentryError) {
      // Don't fail if Sentry fails
      logger.warn({ routeName: 'sentry' }, 'Failed to report error to Sentry')
    }
  }

  // Return consistent error response
  return Response.json(
    {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong.',
    },
    { status: 500 }
  )
}

/**
 * Wrapper for API route handlers with automatic error handling
 */
export function withApiErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<Response>,
  routeName: string
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      // Extract context from request if available
      const request = args[0] instanceof Request ? args[0] : undefined
      const url = request ? new URL(request.url) : undefined
      
      // Try to extract userId from session/auth if available
      // (This is a simple version - routes can pass more context)
      const context: ErrorContext = {
        routeName,
        path: url?.pathname,
      }

      return handleApiError(error, context, request)
    }
  }
}

