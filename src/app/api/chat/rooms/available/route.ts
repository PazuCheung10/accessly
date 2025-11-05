import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/chat/rooms/available
 * List all public rooms and private rooms user can see (but isn't a member of yet)
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      }, { status: 401 })
    }

    // Get rooms user is already a member of
    const userMemberships = await prisma.roomMember.findMany({
      where: { userId: session.user.id },
      select: { roomId: true },
    })
    const userRoomIds = userMemberships.map((m) => m.roomId)

    // Fetch all public rooms
    const allRooms = await prisma.room.findMany({
      where: {
        isPrivate: false, // Only show public rooms
      },
      select: {
        id: true,
        name: true,
        isPrivate: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Filter out rooms user is already a member of
    const availableRooms = allRooms.filter((room) => !userRoomIds.includes(room.id))

    return Response.json({
      ok: true,
      data: {
        rooms: availableRooms,
      },
    })
  } catch (error: any) {
    console.error('Error fetching available rooms:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

