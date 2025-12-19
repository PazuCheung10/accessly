/**
 * Sentry server-side configuration
 * Only enabled if SENTRY_DSN is set and not in test environment
 * Next.js automatically loads this file from the root
 * 
 * If SENTRY_DSN is not set, this file does nothing (no-op)
 */

// Early return if DSN is not configured - avoids importing Sentry unnecessarily
if (!process.env.SENTRY_DSN || process.env.NODE_ENV === 'test') {
  // No-op: Sentry not configured
} else {
  try {
    // Dynamic require to avoid build-time issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nextjs')
    if (Sentry && typeof Sentry.init === 'function') {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0, // Disable performance tracing for Phase 1
        enabled: true,
      })
    }
  } catch (error) {
    // Silently fail if Sentry can't be initialized
    // Don't log in production to avoid noise
  }
}

