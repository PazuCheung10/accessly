import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ActivityFeed } from '@/components/activity/ActivityFeed'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function ActivityPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/activity')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Activity Feed</h1>
          <p className="text-slate-400">
            Recent activity from tickets, rooms, and messages
          </p>
        </div>

        <ActivityFeed initialLimit={50} />
      </div>
    </div>
  )
}

