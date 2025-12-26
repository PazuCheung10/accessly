import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TelemetryDashboard } from '@/components/admin/TelemetryDashboard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function TelemetryPage() {
  const { auth } = await import('@/lib/auth')
  const { prisma } = await import('@/lib/prisma')
  const { Role } = await import('@prisma/client')
  
  const session = await auth()

  // Require authentication
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/admin/telemetry')
  }

  // Verify user is admin
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email || '' },
    select: { id: true, role: true },
  })

  if (!dbUser || dbUser.role !== Role.ADMIN) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Observability Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Real-time system metrics and performance monitoring
          </p>
        </div>

        {/* Admin Navigation */}
        <div className="mb-8 flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Overview
          </Link>
          <Link
            href="/admin/telemetry"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
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

        <TelemetryDashboard />
      </div>
    </div>
  )
}

