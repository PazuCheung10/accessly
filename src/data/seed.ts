import { PrismaClient, Role, RoomRole, RoomType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Hash password for admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@accessly.com' },
    update: {
      password: hashedPassword, // Update password if user exists
    },
    create: {
      email: 'admin@accessly.com',
      name: 'Admin User',
      emailVerified: new Date(),
      role: Role.ADMIN,
      password: hashedPassword,
    },
  })
  console.log('✅ Created admin user:', admin.email)
  console.log('   Password: admin123')

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'user@accessly.com' },
    update: {
      password: userPassword, // Update password if user exists
    },
    create: {
      email: 'user@accessly.com',
      name: 'Regular User',
      emailVerified: new Date(),
      role: Role.USER,
      password: userPassword,
    },
  })
  console.log('✅ Created regular user:', user.email)
  console.log('   Password: user123')

  // Create demo observer user (read-only for public demo)
  const demoObserverPassword = await bcrypt.hash('demo123', 10)
  const demoObserver = await prisma.user.upsert({
    where: { email: 'demo@accessly.com' },
    update: {
      password: demoObserverPassword, // Update password if user exists
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
    },
    create: {
      email: 'demo@accessly.com',
      name: 'Demo Observer',
      emailVerified: new Date(),
      role: Role.DEMO_OBSERVER,
      password: demoObserverPassword,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
    },
  })
  console.log('✅ Created demo observer user:', demoObserver.email)
  console.log('   Password: demo123')
  console.log('   Role: DEMO_OBSERVER (read-only)')

  // Create public rooms with tags
  const generalRoom = await prisma.room.upsert({
    where: { name: '#general' },
    update: {
      title: 'General Discussion',
      description: 'General chat for everyone',
      type: RoomType.PUBLIC,
      creatorId: admin.id,
      tags: ['general', 'chat', 'community'],
    },
    create: {
      name: '#general',
      title: 'General Discussion',
      description: 'General chat for everyone',
      isPrivate: false,
      type: RoomType.PUBLIC,
      creatorId: admin.id,
      tags: ['general', 'chat', 'community'],
    },
  })
  console.log('✅ Created room:', generalRoom.name)

  const randomRoom = await prisma.room.upsert({
    where: { name: '#random' },
    update: {
      title: 'Random Chat',
      description: 'Random topics and off-topic discussions',
      type: RoomType.PUBLIC,
      creatorId: admin.id,
      tags: ['random', 'off-topic', 'fun'],
    },
    create: {
      name: '#random',
      title: 'Random Chat',
      description: 'Random topics and off-topic discussions',
      isPrivate: false,
      type: RoomType.PUBLIC,
      creatorId: admin.id,
      tags: ['random', 'off-topic', 'fun'],
    },
  })
  console.log('✅ Created room:', randomRoom.name)

  // Create another public room with different tags
  const techRoom = await prisma.room.upsert({
    where: { name: '#tech' },
    update: {
      title: 'Tech Talk',
      description: 'Discuss technology, programming, and development',
      type: RoomType.PUBLIC,
      creatorId: admin.id,
      tags: ['tech', 'programming', 'development'],
    },
    create: {
      name: '#tech',
      title: 'Tech Talk',
      description: 'Discuss technology, programming, and development',
      isPrivate: false,
      type: RoomType.PUBLIC,
      creatorId: admin.id,
      tags: ['tech', 'programming', 'development'],
    },
  })
  console.log('✅ Created room:', techRoom.name)

  // Create private room
  const privateRoom = await prisma.room.upsert({
    where: { name: '#private' },
    update: {
      title: 'Private Discussion',
      description: 'Private room for invited members only',
      type: RoomType.PRIVATE,
      creatorId: admin.id,
      tags: ['private'],
    },
    create: {
      name: '#private',
      title: 'Private Discussion',
      description: 'Private room for invited members only',
      isPrivate: true,
      type: RoomType.PRIVATE,
      creatorId: admin.id,
      tags: ['private'],
    },
  })
  console.log('✅ Created private room:', privateRoom.name)

  // Create DM room between admin and user
  const dmRoom = await prisma.room.upsert({
    where: { name: `dm-${admin.id}-${user.id}` },
    update: {
      title: `DM: ${admin.name} & ${user.name}`,
      description: null,
      type: RoomType.DM,
      creatorId: admin.id,
      tags: [],
    },
    create: {
      name: `dm-${admin.id}-${user.id}`,
      title: `DM: ${admin.name} & ${user.name}`,
      description: null,
      isPrivate: true,
      type: RoomType.DM,
      creatorId: admin.id,
      tags: [],
    },
  })
  console.log('✅ Created DM room:', dmRoom.name)

  // Add admin as owner of all rooms (except DM, where both are members)
  const roomsToAddAdmin = [generalRoom, randomRoom, techRoom, privateRoom]
  for (const room of roomsToAddAdmin) {
    await prisma.roomMember.upsert({
      where: {
        userId_roomId: {
          userId: admin.id,
          roomId: room.id,
        },
      },
      update: {
        role: RoomRole.OWNER,
      },
      create: {
        userId: admin.id,
        roomId: room.id,
        role: RoomRole.OWNER,
      },
    })
  }
  console.log('✅ Added admin as owner of all public/private rooms')

  // Add regular user as member of public rooms
  const publicRooms = [generalRoom, randomRoom, techRoom]
  for (const room of publicRooms) {
    await prisma.roomMember.upsert({
      where: {
        userId_roomId: {
          userId: user.id,
          roomId: room.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roomId: room.id,
        role: RoomRole.MEMBER,
      },
    })
  }
  console.log('✅ Added regular user as member of public rooms')

  // Add both admin and user to DM room (exactly 2 members)
  await prisma.roomMember.upsert({
    where: {
      userId_roomId: {
        userId: admin.id,
        roomId: dmRoom.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roomId: dmRoom.id,
      role: RoomRole.MEMBER, // DMs don't have owners, just members
    },
  })

  await prisma.roomMember.upsert({
    where: {
      userId_roomId: {
        userId: user.id,
        roomId: dmRoom.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roomId: dmRoom.id,
      role: RoomRole.MEMBER,
    },
  })
  console.log('✅ Added admin and user to DM room (2 members)')

  console.log('✨ Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })