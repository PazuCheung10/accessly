import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Role } from '@prisma/client'
import { CreateRoomForm } from '@/components/CreateRoomForm'
import { AdminPanel } from '@/components/AdminPanel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminPage() {
  const { auth } = await import('@/lib/auth')
  const { assertRole } = await import('@/lib/rbac')
  
  const session = await auth()

  // Require authentication
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/admin')
  }

  // Require ADMIN role
  try {
    assertRole(session, Role.ADMIN)
  } catch (error) {
    redirect('/dashboard')
  }

  // Fetch stats
  const { prisma } = await import('@/lib/prisma')
  const totalUsers = await prisma.user.count()
  const totalMessages = await prisma.message.count()
  const totalRooms = await prisma.room.count()

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">System Dashboard</h1>
          <p className="text-slate-400 mt-1">
            System administration and user management
          </p>
        </div>

        {/* Admin Navigation */}
        <div className="mb-8 flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
          >
            Overview
          </Link>
          <Link
            href="/admin/telemetry"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            📊 Observability Dashboard
          </Link>
          <Link
            href="/admin/audit"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            📝 Audit Log
          </Link>
          <Link
            href="/admin/staff-analytics"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            👥 Staff Analytics
          </Link>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-purple-500/10 backdrop-blur border border-purple-500/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-purple-300">Total Users</h3>
            <p className="text-3xl font-bold text-purple-400">{totalUsers}</p>
          </div>
          <div className="bg-purple-500/10 backdrop-blur border border-purple-500/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-purple-300">Total Messages</h3>
            <p className="text-3xl font-bold text-purple-400">{totalMessages}</p>
          </div>
          <div className="bg-purple-500/10 backdrop-blur border border-purple-500/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-purple-300">Total Rooms</h3>
            <p className="text-3xl font-bold text-purple-400">{totalRooms}</p>
          </div>
        </div>

        {/* Create Room Section */}
        <div className="bg-purple-500/10 backdrop-blur border border-purple-500/30 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-purple-300">Create New Room</h2>
          <CreateRoomForm />
        </div>

        {/* System Management with Actions */}
        <AdminPanel />
      </div>
    </div>
  )
}