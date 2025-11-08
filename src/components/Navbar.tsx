'use client'

import { useSession, signOut } from 'next-auth/react'
// Role type for client component (avoid importing @prisma/client in client)
type Role = 'USER' | 'ADMIN'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SearchBar } from './SearchBar'

export function Navbar() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  if (status === 'loading') {
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

  const roleBadgeColor =
    session.user.role === 'ADMIN'
      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      : 'bg-slate-700/50 text-slate-300 border-slate-600/50'

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
            <SearchBar className="flex-1" />
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

              {/* Role Badge */}
              <span
                className={`px-2 py-1 text-xs font-semibold rounded border ${roleBadgeColor}`}
              >
                {session.user.role}
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