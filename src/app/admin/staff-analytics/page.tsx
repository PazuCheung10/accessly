import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StaffAnalyticsDashboard } from '@/components/admin/StaffAnalyticsDashboard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function StaffAnalyticsPage() {
  const { auth } = await import('@/lib/auth')
  const { prisma } = await import('@/lib/prisma')
  const { Role } = await import('@prisma/client')
  
  const session = await auth()

  // Require authentication
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/admin/staff-analytics')
  }

  // Verify user is admin
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email || '' },
    select: { id: true, role: true },
  })

  if (!dbUser || dbUser.role !== Role.ADMIN) {
    redirect('/')
  }

  // Fetch analytics data directly (server-side)
  const { getStaffAnalytics } = await import('@/app/api/admin/staff-analytics/logic')
  const data = await getStaffAnalytics()

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Staff Analytics</h1>
          <p className="text-slate-400 mt-1">
            Staff performance metrics and response time analytics
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
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
          >
            👥 Staff Analytics
          </Link>
        </div>

        <StaffAnalyticsDashboard data={data} />
      </div>
    </div>
  )
}

