import { prisma } from './prisma'
import { Role, RoomType } from '@prisma/client'

/**
 * Check if a user is an internal staff member (not an external customer)
 * 
 * Returns true if user:
 * - has role ADMIN, OR
 * - has any PUBLIC or PRIVATE room memberships
 * 
 * Internal users can see and access internal collaboration rooms.
 * 
 * @param userId - User ID to check
 * @returns Promise<boolean> - true if user is internal staff
 */
export async function isInternalUser(userId: string): Promise<boolean> {
  // First check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user) {
    return false
  }

  if (user.role === Role.ADMIN) {
    return true
  }

  // Check if user has any PUBLIC or PRIVATE room memberships
  const hasInternalRoom = await prisma.roomMember.findFirst({
    where: {
      userId,
      room: {
        type: { in: [RoomType.PUBLIC, RoomType.PRIVATE] },
      },
    },
  })

  return !!hasInternalRoom
}

/**
 * Check if user is an external customer
 * 
 * Returns true if:
 * - user.role === "USER"
 * - user.department === null
 * - user has NO PUBLIC or PRIVATE room memberships
 * 
 * External customers should only see their own tickets, not internal rooms.
 * 
 * @param userId - User ID to check
 * @returns Promise<boolean> - true if user is external customer
 */
export async function isExternalCustomer(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, department: true },
  })

  if (!user) {
    return false
  }

  // Admins are never external customers
  if (user.role === Role.ADMIN) {
    return false
  }

  // External customers have no department
  if (user.department !== null) {
    return false
  }

  // Check if user has any PUBLIC or PRIVATE room memberships
  const hasInternalRoom = await prisma.roomMember.findFirst({
    where: {
      userId,
      room: {
        type: { in: [RoomType.PUBLIC, RoomType.PRIVATE] },
      },
    },
  })

  // External customer = USER role + null department + no internal room memberships
  return !hasInternalRoom
}


