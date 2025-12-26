import { redirect } from 'next/navigation'
import { IssuesList } from '@/components/issues/IssuesList'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function IssuesPage() {
  const session = await auth()

  // Require authentication
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/issues')
  }

  // Verify user exists in DB
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email || '' },
    select: { id: true, role: true },
  })

  if (!dbUser) {
    redirect('/sign-in?callbackUrl=/issues')
  }

  const isAdmin = dbUser.role === Role.ADMIN

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Issues</h1>
            <p className="text-slate-400 mt-1">
              {isAdmin ? 'Manage and respond to all issues' : 'Issues assigned to you'}
            </p>
          </div>
        </div>

        <IssuesList isAdmin={isAdmin} userId={dbUser.id} />
      </div>
    </div>
  )
}

