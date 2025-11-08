import { redirect } from 'next/navigation'
import { SearchResults } from '@/components/SearchResults'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; roomId?: string }>
}) {
  const { auth } = await import('@/lib/auth')
  
  const session = await auth()

  // Require authentication
  if (!session?.user) {
    redirect('/sign-in?callbackUrl=/search')
  }

  const params = await searchParams
  const query = params.q || ''
  const roomId = params.roomId || null

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Search</h1>
        <SearchResults initialQuery={query} initialRoomId={roomId} />
      </div>
    </div>
  )
}

