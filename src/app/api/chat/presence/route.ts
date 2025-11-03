export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/chat/presence
 * Update user's lastSeen timestamp
 * Note: With Socket.io, presence is handled via socket events,
 * but this endpoint can be used as a heartbeat/fallback
 */
export async function POST(request: Request) {
  // Lazy load server-only dependencies at runtime
  const { auth } = await import('@/lib/auth')
  const { prisma } = await import('@/lib/prisma')
  
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      })
    }

    // Update user's updatedAt timestamp as a heartbeat
    // (Note: User model doesn't have lastSeen field, using updatedAt as proxy)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { updatedAt: new Date() },
    })

    return Response.json({
      ok: true,
      data: {
        userId: session.user.id,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Error updating presence:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    })
  }
}