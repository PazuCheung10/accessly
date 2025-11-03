import { redirect } from 'next/navigation'
import { Role } from '@prisma/client'

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

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
        <p className="text-slate-400 mb-8">SSR admin panel (role: admin)</p>

        <div className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Admin Controls</h2>
          <p className="text-slate-300 mb-4">
            Welcome, {session.user.name || session.user.email}
          </p>
          <p className="text-sm text-slate-400">
            This page is only accessible to users with the ADMIN role.
          </p>
        </div>
      </div>
    </div>
  )
}