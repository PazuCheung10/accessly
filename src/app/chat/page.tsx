import ChatPageClient from './ChatPageClient'

export default async function ChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ room?: string; view?: string }> | { room?: string; view?: string }
}) {
  // Handle both Promise and direct object for searchParams (Next.js 15 compatibility)
  const params = searchParams instanceof Promise ? await searchParams : searchParams
  const initialRoomId = params?.room ?? null
  // View parameter is deprecated - we only show rooms now (no DM tab)
  return <ChatPageClient initialRoomId={initialRoomId} />
}
