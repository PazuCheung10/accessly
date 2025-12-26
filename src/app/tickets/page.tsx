import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Redirect /tickets to /issues since they're now combined
export default async function TicketsPage() {
  redirect('/issues')
}

