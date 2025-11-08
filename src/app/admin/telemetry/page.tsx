import { redirect } from 'next/navigation'
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
        <h1 className="text-3xl font-bold mb-6">Observability Dashboard</h1>
        <TelemetryDashboard />
      </div>
    </div>
  )
}

