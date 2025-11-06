import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking database state...\n')

  // Get all users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
    orderBy: {
      email: 'asc',
    },
  })

  console.log(`📊 Users (${users.length}):`)
  for (const user of users) {
    const memberships = await prisma.roomMember.count({
      where: { userId: user.id },
    })
    console.log(`  - ${user.email} (${user.role}): ${memberships} room memberships`)
  }

  console.log('\n📊 Rooms:')
  const rooms = await prisma.room.findMany({
    select: {
      id: true,
      name: true,
      title: true,
      type: true,
      creatorId: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  for (const room of rooms) {
    const members = await prisma.roomMember.count({
      where: { roomId: room.id },
    })
    const messages = await prisma.message.count({
      where: { roomId: room.id },
    })
    console.log(`  - ${room.name} (${room.type}): ${members} members, ${messages} messages`)
  }

  console.log('\n📊 Total counts:')
  console.log(`  - Users: ${users.length}`)
  console.log(`  - Rooms: ${rooms.length}`)
  console.log(`  - Messages: ${await prisma.message.count()}`)
  console.log(`  - Memberships: ${await prisma.roomMember.count()}`)

  // Check for orphaned messages (messages without valid user)
  const allMessages = await prisma.message.findMany({
    select: {
      id: true,
      userId: true,
      roomId: true,
    },
    take: 10,
  })

  console.log('\n📊 Sample messages:')
  for (const msg of allMessages.slice(0, 5)) {
    const user = await prisma.user.findUnique({
      where: { id: msg.userId },
      select: { email: true },
    })
    const room = await prisma.room.findUnique({
      where: { id: msg.roomId },
      select: { name: true },
    })
    console.log(`  - Message ${msg.id}: user=${user?.email || 'NOT FOUND'}, room=${room?.name || 'NOT FOUND'}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

