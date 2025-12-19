/**
 * Request logging wrapper for Phase 2 Ops
 * Tracks request duration and logs request/response details
 */

import { logger } from './logger'
import { auth } from './auth'
import { prisma } from './prisma'
import { AsyncLocalStorage } from 'async_hooks'
import { metricsStore } from './metrics'

const SLOW_REQUEST_THRESHOLD_MS = 1000

// Store request context (requestId) per async execution
const requestContext = new AsyncLocalStorage<{ requestId: string }>()

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Extract user ID from request (if authenticated)
 */
async function getUserIdFromRequest(): Promise<string | undefined> {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return undefined
    }
    
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    
    return dbUser?.id
  } catch {
    // Silently fail - userId is optional
    return undefined
  }
}

/**
 * Wrapper for API route handlers with request logging
 */
export function withRequestLogging<T extends any[]>(
  handler: (...args: T) => Promise<Response>,
  routeName: string
) {
  return async (...args: T): Promise<Response> => {
    const request = args[0] instanceof Request ? args[0] : undefined
    if (!request) {
      // Fallback if no request object
      return await handler(...args)
    }

    const requestId = generateRequestId()
    const startTime = Date.now()
    const url = new URL(request.url)
    const method = request.method
    const path = url.pathname

    let userId: string | undefined
    let statusCode = 500
    let duration = 0

    try {
      // Get userId (non-blocking - don't fail if auth fails)
      // Skip for health check, Next.js internal routes, and static assets to avoid unnecessary DB calls
      if (
        path !== '/api/health' &&
        !path.startsWith('/_next') &&
        !path.startsWith('/api/_next') &&
        path.startsWith('/api/')
      ) {
        try {
          // Use Promise.race with timeout to avoid hanging
          userId = await Promise.race([
            getUserIdFromRequest(),
            new Promise<string | undefined>((resolve) =>
              setTimeout(() => resolve(undefined), 500)
            ),
          ])
        } catch {
          // Ignore auth errors - userId is optional
        }
      }

      // Store requestId in async context for error handler to access
      // Use try-catch to handle cases where AsyncLocalStorage might not work
      let response: Response
      try {
        response = await requestContext.run({ requestId }, async () => {
          return await handler(...args)
        })
      } catch (alsError) {
        // Fallback if AsyncLocalStorage fails (e.g., in edge runtime)
        logger.warn(
          { routeName, requestId, path },
          'AsyncLocalStorage failed, falling back to direct handler call'
        )
        response = await handler(...args)
      }
      
      // Extract status code
      statusCode = response.status
      duration = Date.now() - startTime

      // Log request completion
      const logContext = {
        routeName,
        requestId,
        method,
        path,
        statusCode,
        durationMs: duration,
        userId,
      }

      // Track 5xx errors in metrics
      if (statusCode >= 500 && statusCode < 600) {
        metricsStore.increment5xxError(routeName)
      }

      if (duration > SLOW_REQUEST_THRESHOLD_MS) {
        logger.warn(logContext, `Slow request: ${method} ${path} took ${duration}ms`)
      } else {
        logger.info(logContext, `Request: ${method} ${path} ${statusCode}`)
      }

      // Add requestId to response headers for debugging
      // Try to clone response, but if that fails, return original (header is optional)
      try {
        // Clone response to add header without consuming body
        const clonedResponse = response.clone()
        clonedResponse.headers.set('X-Request-ID', requestId)
        return clonedResponse
      } catch (error) {
        // If cloning fails (body already consumed), return original response
        // The requestId is still logged, so we don't lose observability
        return response
      }
    } catch (error) {
      duration = Date.now() - startTime
      statusCode = 500

      // Log failed request
      const logContext = {
        routeName,
        requestId,
        method,
        path,
        statusCode,
        durationMs: duration,
        userId,
        error: true,
      }

      logger.error(
        logContext,
        error instanceof Error ? error : new Error(String(error)),
        { requestFailed: true }
      )

      // Re-throw to let error handler deal with it
      throw error
    }
  }
}

/**
 * Get request ID from async context (set by request logger)
 * Useful for correlating logs across services
 */
export function getRequestId(): string | undefined {
  const context = requestContext.getStore()
  return context?.requestId
}

