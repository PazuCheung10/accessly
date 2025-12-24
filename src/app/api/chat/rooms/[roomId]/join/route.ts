import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isExternalCustomer } from '@/lib/user-utils'
import { RoomType } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/chat/rooms/[roomId]/join
 * Join a room (public rooms only)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      console.error('Join room: No session')
      return Response.json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      }, { status: 401 })
    }

    const { roomId } = await params

    // Verify the user exists in DB and get their actual ID
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
      select: { id: true, email: true },
    })

    if (!dbUser) {
      console.error('Join room: User not found in database:', session.user.email)
      return Response.json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
      }, { status: 404 })
    }

    // Use DB user ID (source of truth)
    const userId = dbUser.id
    const sessionIdMatches = session.user.id === dbUser.id

    console.log('Join room request:', {
      roomId,
      sessionUserId: session.user.id,
      dbUserId: userId,
      idMatch: sessionIdMatches,
      userEmail: session.user.email,
    })

    if (!sessionIdMatches) {
      console.warn('⚠️ Session user ID does not match DB user ID! Using DB ID.')
    }

    // Check if room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        title: true,
        type: true,
        isPrivate: true,
      },
    })

    if (!room) {
      return Response.json({
        ok: false,
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      }, { status: 404 })
    }

    // Block external customers from joining any rooms
    const userIsExternal = await isExternalCustomer(userId)
    if (userIsExternal) {
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'External customers cannot join internal rooms',
      }, { status: 403 })
    }

    // Only allow joining public rooms
    if (room.type !== RoomType.PUBLIC) {
      console.error('Cannot join non-public room:', {
        roomId,
        roomType: room.type,
        isPrivate: room.isPrivate,
      })
      return Response.json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Cannot join private room. Use invite endpoint instead.',
      }, { status: 403 })
    }
    
    // Double-check: if isPrivate is true but type is PUBLIC, something is wrong
    if (room.isPrivate && room.type === RoomType.PUBLIC) {
      console.warn('Room has conflicting flags:', { roomId, type: room.type, isPrivate: room.isPrivate })
    }

    // Check if user is already a member (use DB user ID)
    const existingMembership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: userId, // Use DB user ID
          roomId,
        },
      },
    })

    if (existingMembership) {
      console.log('User already a member:', { roomId, userId })
      return Response.json({
        ok: true,
        code: 'ALREADY_MEMBER',
        message: 'Already a member of this room',
        data: {
          membership: existingMembership,
        },
      })
    }

    // Add user as member (use DB user ID)
    console.log('Creating membership:', { roomId, userId })
    const membership = await prisma.roomMember.create({
      data: {
        userId: userId, // Use DB user ID
        roomId,
        role: 'MEMBER',
      },
    })

    console.log('Successfully joined room:', { roomId, userId, membershipId: membership.id })
    return Response.json({
      ok: true,
      code: 'JOINED',
      message: 'Successfully joined room',
      data: {
        membership,
        room: {
          id: room.id,
          name: room.name,
          title: room.title,
          type: room.type,
        },
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error joining room:', error)
    return Response.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }, { status: 500 })
  }
}

