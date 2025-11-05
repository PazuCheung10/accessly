export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Chat page doesn't need the navbar - it's full screen
  return <>{children}</>
}

