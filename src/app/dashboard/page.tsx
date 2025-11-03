import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function DashboardPage() {
  const { auth } = await import('@/lib/auth')
  const session = await auth()

  // Require authentication
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/dashboard')
  }

  // Dashboard is accessible to both USER and ADMIN roles
  // (no additional role check needed since any authenticated user can access)

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <p className="text-slate-400 mb-8">SSR dashboard (role: user+admin)</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Welcome</h2>
            <p className="text-slate-300">
              {session.user.name || session.user.email}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Role</h2>
            <p className="text-slate-300">{session.user.role}</p>
          </div>

          <div className="bg-white/10 backdrop-blur border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Status</h2>
            <p className="text-slate-300">Authenticated</p>
          </div>
        </div>
      </div>
    </div>
  )
}