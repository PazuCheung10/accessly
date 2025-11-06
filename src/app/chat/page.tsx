import ChatPageClient from './ChatPageClient'

export default function ChatPage({
  searchParams,
}: {
  searchParams?: { room?: string }
}) {
  const initialRoomId = searchParams?.room ?? null
  return <ChatPageClient initialRoomId={initialRoomId} />
}
