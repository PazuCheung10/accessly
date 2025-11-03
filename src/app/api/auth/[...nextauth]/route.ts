export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Lazy load handlers at runtime to avoid build-time evaluation
export async function GET(request: Request) {
  const { handlers } = await import('@/lib/auth')
  return handlers.GET(request)
}

export async function POST(request: Request) {
  const { handlers } = await import('@/lib/auth')
  return handlers.POST(request)
}