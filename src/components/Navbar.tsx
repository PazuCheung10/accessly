'use client'

import { useSession, signOut } from 'next-auth/react'
// Role type for client component (avoid importing @prisma/client in client)
type Role = 'USER' | 'ADMIN'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SearchBar } from './SearchBar'
import { useEffect, useState } from 'react'

export function Navbar() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [isInternalUser, setIsInternalUser] = useState<boolean | null>(null)
  const [userDepartment, setUserDepartment] = useState<string | null>(null)

  // Add timeout to prevent infinite loading
  useEffect(() => {
    if (status === 'loading') {
      const timer = setTimeout(() => {
        setLoadingTimeout(true)
      }, 3000) // 3 second timeout
      return () => clearTimeout(timer)
    } else {
      setLoadingTimeout(false)
    }
  }, [status])

  // Check if user is internal and get department (to hide Support link and show badge)
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      fetch('/api/user/check-internal')
        .then(res => res.json())
        .then(data => {
          setIsInternalUser(data.isInternal || false)
          setUserDepartment(data.department || null)
        })
        .catch(() => {
          setIsInternalUser(false)
          setUserDepartment(null)
        })
    } else {
      setIsInternalUser(false)
      setUserDepartment(null)
    }
  }, [status, session?.user?.email])

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  // Show unauthenticated state if loading takes too long
  if (status === 'loading' && !loadingTimeout) {
    return (
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-cyan-300">
              Accessly
            </Link>
            <div className="text-slate-400">Loading...</div>
          </div>
        </div>
      </nav>
    )
  }

  if (!session?.user) {
    return (
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-xl font-bold text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
            >
              Accessly
            </Link>
            <Link
              href="/sign-in"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>
    )
  }

  // Badge colors and labels
  const getBadgeInfo = () => {
    if (session.user.role === 'ADMIN') {
      return {
        label: 'ADMIN',
        color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      }
    }
    
    // For non-admin internal employees, show department
    if (isInternalUser === true && userDepartment) {
      const departmentLabels: Record<string, string> = {
        ENGINEERING: 'Engineering',
        BILLING: 'Billing',
        PRODUCT: 'Product',
        GENERAL: 'General',
      }
      const departmentColors: Record<string, string> = {
        ENGINEERING: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        BILLING: 'bg-green-500/20 text-green-300 border-green-500/30',
        PRODUCT: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        GENERAL: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      }
      return {
        label: departmentLabels[userDepartment] || userDepartment,
        color: departmentColors[userDepartment] || 'bg-slate-700/50 text-slate-300 border-slate-600/50',
      }
    }
    
    // External customers show USER badge
    return {
      label: 'USER',
      color: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
    }
  }

  const badgeInfo = getBadgeInfo()

  return (
    <nav className="bg-slate-900 border-b border-slate-800" role="navigation">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <Link
            href="/"
            className="text-xl font-bold text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
          >
            Accessly
          </Link>

          <div className="flex items-center gap-6 flex-1 max-w-2xl mx-6">
            {/* Search bar - only shown for internal employees (not external customers) */}
            {isInternalUser === true && (
              <SearchBar className="flex-1" />
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Support Link - visible only for external customers (not internal employees) */}
            {isInternalUser === false && (
              <Link
                href="/support"
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Support
              </Link>
            )}

            {/* Admin Panel Link - visible only for admins */}
            {session.user.role === 'ADMIN' && (
              <Link
                href="/admin"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900 font-medium"
              >
                Admin
              </Link>
            )}

            {/* Tickets Link - visible only for admins */}
            {session.user.role === 'ADMIN' && (
              <Link
                href="/tickets"
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Tickets
              </Link>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              {/* User Avatar */}
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User avatar'}
                  className="w-8 h-8 rounded-full border-2 border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-medium">
                  {session.user.name?.[0]?.toUpperCase() ||
                    session.user.email?.[0]?.toUpperCase() ||
                    '?'}
                </div>
              )}

              {/* User Name */}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">
                  {session.user.name || session.user.email || 'User'}
                </span>
                <span className="text-xs text-slate-400">{session.user.email}</span>
              </div>

              {/* Role/Department Badge */}
              <span
                className={`px-2 py-1 text-xs font-semibold rounded border ${badgeInfo.color}`}
              >
                {badgeInfo.label}
              </span>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}