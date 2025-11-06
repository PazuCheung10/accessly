import { PrismaClient } from '@prisma/client'
import { env } from '../lib/env'

const prisma = new PrismaClient()

async function diagnose() {
  console.log('🔍 Diagnosing chat room visibility issue...\n')

  // 1. Check database connection
  console.log('1️⃣ Database Connection:')
  const dbUrl = env.DATABASE_URL
  try {
    const url = new URL(dbUrl)
    console.log(`   Host: ${url.hostname}:${url.port || '5432'}`)
    console.log(`   Database: ${url.pathname.slice(1)}`)
    console.log(`   ✅ Connection string valid`)
  } catch (e) {
    console.log(`   ❌ Invalid DATABASE_URL`)
  }

  // 2. Test connection
  try {
    await prisma.$connect()
    console.log(`   ✅ Successfully connected to database\n`)
  } catch (error: any) {
    console.log(`   ❌ Failed to connect: ${error.message}\n`)
    return
  }

  // 3. Count all entities
  console.log('2️⃣ Database Contents:')
  const totalUsers = await prisma.user.count()
  const totalRooms = await prisma.room.count()
  const totalMessages = await prisma.message.count()
  const totalMemberships = await prisma.roomMember.count()

  console.log(`   Users: ${totalUsers}`)
  console.log(`   Rooms: ${totalRooms}`)
  console.log(`   Messages: ${totalMessages}`)
  console.log(`   Memberships: ${totalMemberships}\n`)

  // 4. Check demo users exist
  console.log('3️⃣ Demo Users:')
  const demoUsers = await prisma.user.findMany({
    where: {
      email: {
        in: [
          'admin@demo.com',
          'sarah@demo.com',
          'mike@demo.com',
          'emma@demo.com',
          'david@demo.com',
        ],
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  })

  if (demoUsers.length === 0) {
    console.log(`   ❌ No demo users found!`)
    console.log(`   💡 Run: pnpm db:seed-demo\n`)
  } else {
    console.log(`   ✅ Found ${demoUsers.length} demo users:`)
    for (const user of demoUsers) {
      const memberships = await prisma.roomMember.count({
        where: { userId: user.id },
      })
      console.log(`      - ${user.email} (${user.role}): ${memberships} room memberships`)
    }
    console.log()
  }

  // 5. Check rooms
  console.log('4️⃣ Rooms:')
  const rooms = await prisma.room.findMany({
    select: {
      id: true,
      name: true,
      title: true,
      type: true,
      isPrivate: true,
      _count: {
        select: {
          members: true,
          messages: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (rooms.length === 0) {
    console.log(`   ❌ No rooms found!`)
    console.log(`   💡 Run: pnpm db:seed-demo\n`)
  } else {
    console.log(`   ✅ Found ${rooms.length} rooms:`)
    for (const room of rooms) {
      console.log(
        `      - ${room.name} (${room.type}): ${room._count.members} members, ${room._count.messages} messages`
      )
    }
    console.log()
  }

  // 6. Check memberships for demo users
  console.log('5️⃣ Room Memberships (Demo Users):')
  for (const user of demoUsers) {
    const memberships = await prisma.roomMember.findMany({
      where: { userId: user.id },
      include: {
        room: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    })

    if (memberships.length === 0) {
      console.log(`   ❌ ${user.email}: No memberships!`)
    } else {
      console.log(`   ✅ ${user.email}: ${memberships.length} rooms`)
      for (const m of memberships) {
        console.log(`      - ${m.room.name} (${m.room.type})`)
      }
    }
  }
  console.log()

  // 7. Check for orphaned users
  console.log('6️⃣ All Users (check for orphaned):')
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  if (allUsers.length > demoUsers.length) {
    console.log(`   ⚠️  Found ${allUsers.length - demoUsers.length} non-demo users:`)
    for (const user of allUsers) {
      if (!demoUsers.find((d) => d.id === user.id)) {
        const memberships = await prisma.roomMember.count({
          where: { userId: user.id },
        })
        console.log(`      - ${user.email}: ${memberships} memberships`)
      }
    }
  } else {
    console.log(`   ✅ All users are demo users`)
  }
  console.log()

  // 8. Summary
  console.log('📋 Summary:')
  console.log(`   Database: ${totalRooms > 0 ? '✅' : '❌'} ${totalRooms} rooms`)
  console.log(`   Demo Users: ${demoUsers.length > 0 ? '✅' : '❌'} ${demoUsers.length} found`)
  console.log(
    `   Memberships: ${totalMemberships > 0 ? '✅' : '❌'} ${totalMemberships} total`
  )

  if (totalRooms === 0) {
    console.log(`\n   💡 Run: pnpm db:seed-demo`)
  } else if (demoUsers.length === 0) {
    console.log(`\n   💡 Run: pnpm db:seed-demo`)
  } else {
    console.log(`\n   ✅ Database looks good!`)
    console.log(`   💡 If you still see no rooms:`)
    console.log(`      1. Sign out and sign in as sarah@demo.com / demo123`)
    console.log(`      2. Visit /api/debug/session to verify your session`)
    console.log(`      3. Visit /api/chat/rooms to see your rooms`)
  }
}

diagnose()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

