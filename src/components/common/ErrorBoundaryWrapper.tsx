'use client'

import { ErrorBoundary } from './ErrorBoundary'

/**
 * Client wrapper for ErrorBoundary to use in server components
 * This is needed because ErrorBoundary must be a client component
 * but we want to use it in server components like layout.tsx
 */
export function ErrorBoundaryWrapper({
  children,
  errorBoundaryName,
}: {
  children: React.ReactNode
  errorBoundaryName?: string
}) {
  return (
    <ErrorBoundary errorBoundaryName={errorBoundaryName}>
      {children}
    </ErrorBoundary>
  )
}

