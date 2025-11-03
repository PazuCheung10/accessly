export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Lazy load handlers at runtime to avoid build-time evaluation
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { handlers } = await import('@/lib/auth')
  return handlers.GET(request)
}

export async function POST(request: NextRequest) {
  const { handlers } = await import('@/lib/auth')
  return handlers.POST(request)
}