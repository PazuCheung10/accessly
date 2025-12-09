import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function DashboardPage() {
  const { auth } = await import('@/lib/auth')
  const session = await auth()

  // Require authentication - redirect to home instead
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/')
  }
  
  // Redirect authenticated users to home (Team Workspace page)
  redirect('/')

  // Dashboard is accessible to both USER and ADMIN roles
  const { Role } = await import('@prisma/client')
  const isAdmin = session.user.role === Role.ADMIN

  // Fetch user stats (messages, rooms)
  const { prisma } = await import('@/lib/prisma')
  const messageCount = await prisma.message.count({
    where: { userId: session.user.id },
  })
  // Count distinct rooms the user is a member of
  const roomMemberships = await prisma.roomMember.findMany({
    where: { userId: session.user.id },
    select: { roomId: true },
    distinct: ['roomId'],
  })
  const roomCount = roomMemberships.length

  // Admin-only stats
  let adminStats = null
  if (isAdmin) {
    const totalUsers = await prisma.user.count()
    const totalMessages = await prisma.message.count()
    const totalRooms = await prisma.room.count()
    adminStats = { totalUsers, totalMessages, totalRooms }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Welcome back, {session.user.name || session.user.email}
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/admin"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Admin Panel
            </Link>
          )}
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Role</h2>
            <div className="flex items-center gap-2">
              <p className="text-slate-300">{session.user.role}</p>
              {isAdmin && (
                <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ADMIN
                </span>
              )}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Messages Sent</h2>
            <p className="text-3xl font-bold text-cyan-400">{messageCount}</p>
          </div>

          <div className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Rooms Joined</h2>
            <p className="text-3xl font-bold text-cyan-400">{roomCount}</p>
          </div>
        </div>

        {/* Admin Stats */}
        {isAdmin && adminStats && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Admin Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-purple-500/10 backdrop-blur border border-purple-500/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2 text-purple-300">Total Users</h3>
                <p className="text-3xl font-bold text-purple-400">{adminStats.totalUsers}</p>
              </div>
              <div className="bg-purple-500/10 backdrop-blur border border-purple-500/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2 text-purple-300">Total Messages</h3>
                <p className="text-3xl font-bold text-purple-400">{adminStats.totalMessages}</p>
              </div>
              <div className="bg-purple-500/10 backdrop-blur border border-purple-500/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2 text-purple-300">Total Rooms</h3>
                <p className="text-3xl font-bold text-purple-400">{adminStats.totalRooms}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/chat"
            className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6 hover:bg-white/15 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">Chat Rooms</h3>
            <p className="text-slate-400">Join conversations and send messages</p>
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className="bg-purple-500/10 backdrop-blur border border-purple-500/30 rounded-lg p-6 hover:bg-purple-500/15 transition-colors"
            >
              <h3 className="text-xl font-semibold mb-2 text-purple-300">Admin Panel</h3>
              <p className="text-slate-400">Manage users and system settings</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}