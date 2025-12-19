/**
 * Client-side error logging utility for Phase 2 Ops
 * Used by React Error Boundary and client-side error handlers
 */

/**
 * Log client-side error to Sentry and console
 */
export function logClientError(
  error: Error,
  errorInfo?: {
    componentStack?: string
    errorBoundary?: string
    [key: string]: any
  }
): void {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Client error:', error)
    if (errorInfo) {
      console.error('Error info:', errorInfo)
    }
  }

  // Report to Sentry if configured
  // Note: Sentry client config handles initialization, we just need to check if it's available
  if (typeof window !== 'undefined' && process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
    // Dynamic import to avoid loading Sentry if not configured
    import('@sentry/nextjs')
      .then((Sentry) => {
        try {
          // Only capture if Sentry is initialized (check if client is available)
          const client = Sentry.getClient()
          if (client) {
            Sentry.captureException(error, {
              tags: {
                source: 'client',
                errorBoundary: errorInfo?.errorBoundary || 'unknown',
              },
              extra: errorInfo,
            })
          }
        } catch (sentryError) {
          // Silently fail if Sentry capture fails
          if (process.env.NODE_ENV === 'development') {
            console.warn('Failed to capture error in Sentry:', sentryError)
          }
        }
      })
      .catch(() => {
        // Silently fail if Sentry import fails
      })
  }
}

