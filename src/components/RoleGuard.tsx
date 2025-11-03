'use client'

import { useSession } from 'next-auth/react'
// Role type for client component (avoid importing @prisma/client in client)
type Role = 'USER' | 'ADMIN'
import { hasRole } from '@/lib/rbac'

type RoleGuardProps = {
  children: React.ReactNode
  role: Role
  fallback?: React.ReactNode
}

/**
 * Client-side role guard (soft check for UI only)
 * WARNING: Never trust client-side checks for security!
 * Always enforce role checks on the server side.
 *
 * This component only hides/shows UI elements based on role.
 * Server-side guards must be the primary security mechanism.
 */
export function RoleGuard({
  children,
  role,
  fallback = null,
}: RoleGuardProps) {
  const { data: session, status } = useSession()

  // Show nothing while loading
  if (status === 'loading') {
    return null
  }

  // Check if user has the required role
  const canAccess = session ? hasRole(session, role) : false

  if (!canAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}