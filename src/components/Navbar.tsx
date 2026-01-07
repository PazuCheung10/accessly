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
  const [imageError, setImageError] = useState(false)

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

  // Reset image error when user changes
  useEffect(() => {
    setImageError(false)
  }, [session?.user?.image])

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
              SolaceDesk
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
              SolaceDesk
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
      <div className="w-full py-3">
        <div className="flex items-center justify-between gap-2 md:gap-4 min-w-0">
          {/* Left side: Logo */}
          <div className="flex items-center flex-shrink-0 pl-4 md:pl-6">
            <Link
              href="/"
              className="text-lg md:text-xl font-bold text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 rounded hidden lg:block"
            >
              SolaceDesk
            </Link>
          </div>

          {/* Center: Search bar and navigation links */}
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 justify-center max-w-5xl mx-4 md:mx-6">
            {/* Search bar - more prominent */}
            <div className="flex-1 min-w-0 max-w-xl md:max-w-2xl">
              <SearchBar className="w-full min-w-0" />
            </div>

            {/* Visual separator */}
            <div className="hidden md:block w-px h-6 bg-slate-700 flex-shrink-0"></div>

            {/* Navigation Links - grouped with better visual treatment */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0 bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-700/50">
              {/* System Dashboard Link - visible only for admins */}
              {session.user.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900 font-medium text-sm whitespace-nowrap"
                >
                  Dashboard
                </Link>
              )}

              {/* Issues Link - visible to all authenticated users */}
              <Link
                href="/issues"
                className="px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 text-sm whitespace-nowrap"
              >
                Issues
              </Link>
            </div>
          </div>

          {/* Right side: User Info and Sign Out */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 pr-4 md:pr-6">
            {/* User Avatar and Info - hide name/role at lg breakpoint, show only on xl+ */}
            <div className="hidden xl:flex items-center gap-2">
              {/* User Avatar */}
              {session.user.image && !imageError ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User avatar'}
                  className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-slate-700 flex-shrink-0"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs md:text-sm font-medium flex-shrink-0">
                  {session.user.name?.[0]?.toUpperCase() ||
                    session.user.email?.[0]?.toUpperCase() ||
                    '?'}
                </div>
              )}

              {/* User Name, Email, and Badge */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs md:text-sm font-medium text-white whitespace-nowrap truncate">
                    {session.user.name || session.user.email?.split('@')[0] || 'User'}
                  </span>
                  {/* Role/Department Badge */}
                  <span
                    className={`px-1.5 py-0.5 text-xs font-semibold rounded border flex-shrink-0 ${badgeInfo.color}`}
                  >
                    {badgeInfo.label}
                  </span>
                </div>
                {session.user.email && (
                  <span className="text-xs text-slate-400 truncate">
                    {session.user.email}
                  </span>
                )}
              </div>
            </div>

            {/* Avatar only - shown on lg screens (between sm and xl) */}
            <div className="hidden lg:flex xl:hidden">
              {session.user.image && !imageError ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User avatar'}
                  className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-slate-700 flex-shrink-0"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs md:text-sm font-medium flex-shrink-0">
                  {session.user.name?.[0]?.toUpperCase() ||
                    session.user.email?.[0]?.toUpperCase() ||
                    '?'}
                </div>
              )}
            </div>

            {/* Mobile: Just avatar */}
            <div className="lg:hidden">
              {session.user.image && !imageError ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User avatar'}
                  className="w-7 h-7 rounded-full border-2 border-slate-700 flex-shrink-0"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-medium flex-shrink-0">
                  {session.user.name?.[0]?.toUpperCase() ||
                    session.user.email?.[0]?.toUpperCase() ||
                    '?'}
                </div>
              )}
            </div>

            {/* Sign Out Button - compact */}
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 text-sm whitespace-nowrap flex-shrink-0"
            >
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Out</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}