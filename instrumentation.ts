/**
 * Next.js instrumentation hook for Sentry
 * This file is automatically loaded by Next.js if present
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry initialization is handled by sentry.server.config.ts
    // This file is here to ensure instrumentation is enabled
  }
}

