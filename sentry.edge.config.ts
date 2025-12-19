/**
 * Sentry edge runtime configuration
 * Only enabled if SENTRY_DSN is set and not in test environment
 */

import * as Sentry from '@sentry/nextjs'

if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0, // Disable performance tracing for Phase 1
    enabled: true,
  })
}

