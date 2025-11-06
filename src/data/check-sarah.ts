import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSarah() {
  console.log('🔍 Checking sarah@demo.com memberships...\n')

  const sarah = await prisma.user.findUnique({
    where: { email: 'sarah@demo.com' },
    select: { id: true, email: true },
  })

  if (!sarah) {
    console.log('❌ sarah@demo.com not found in database')
    return
  }

  console.log(`✅ Found sarah: ${sarah.id}\n`)

  // Get all rooms sarah is a member of
  const memberships = await prisma.roomMember.findMany({
    where: { userId: sarah.id },
    include: {
      room: {
        select: {
          id: true,
          name: true,
          title: true,
          type: true,
        },
      },
    },
  })

  console.log(`📋 sarah is a member of ${memberships.length} rooms:`)
  for (const m of memberships) {
    console.log(`   ✅ ${m.room.name} (${m.room.type}) - role: ${m.role}`)
  }

  // Get all public rooms sarah is NOT a member of
  const allPublicRooms = await prisma.room.findMany({
    where: { type: 'PUBLIC' },
    select: {
      id: true,
      name: true,
      title: true,
    },
  })

  const sarahRoomIds = new Set(memberships.map(m => m.roomId))
  const joinableRooms = allPublicRooms.filter(r => !sarahRoomIds.has(r.id))

  console.log(`\n📋 Public rooms sarah can join (${joinableRooms.length}):`)
  for (const room of joinableRooms) {
    console.log(`   🔓 ${room.name} (${room.title})`)
  }

  console.log('\n✅ Expected:')
  console.log('   - sarah should be in: #general, #tech, #random, #private-team, DM')
  console.log('   - sarah can join: #gaming, #music, #design')
}

checkSarah()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

