import { redirect } from 'next/navigation'
import { Role } from '@prisma/client'
import { TicketsList } from '@/components/tickets/TicketsList'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function TicketsPage() {
  const { auth } = await import('@/lib/auth')
  const { assertRole } = await import('@/lib/rbac')
  
  const session = await auth()

  // Require authentication
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/tickets')
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Issues</h1>
            <p className="text-slate-400 mt-1">
              Manage and respond to internal issues
            </p>
          </div>
        </div>

        <TicketsList showCreateButton={true} />
      </div>
    </div>
  )
}

