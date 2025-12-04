import ChatPageClient from './ChatPageClient'

export default function ChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ room?: string; view?: string }> | { room?: string; view?: string }
}) {
  // Handle both Promise and direct object for searchParams (Next.js 15 compatibility)
  const params = searchParams instanceof Promise ? null : searchParams
  const initialRoomId = params?.room ?? null
  const initialView = (params?.view === 'inbox' ? 'inbox' : 'rooms') as 'rooms' | 'inbox'
  return <ChatPageClient initialRoomId={initialRoomId} initialView={initialView} />
}
