import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSarah() {
  console.log('🔍 Checking jacob@solace.com memberships...\n')

  const jacob = await prisma.user.findUnique({
    where: { email: 'jacob@solace.com' },
    select: { id: true, email: true },
  })

  if (!jacob) {
    console.log('❌ jacob@solace.com not found in database')
    return
  }

  console.log(`✅ Found jacob: ${jacob.id}\n`)

  // Get all rooms jacob is a member of
  const memberships = await prisma.roomMember.findMany({
    where: { userId: jacob.id },
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

  console.log(`📋 jacob is a member of ${memberships.length} rooms:`)
  for (const m of memberships) {
    console.log(`   ✅ ${m.room.name} (${m.room.type}) - role: ${m.role}`)
  }

  // Get all public rooms jacob is NOT a member of
  const allPublicRooms = await prisma.room.findMany({
    where: { type: 'PUBLIC' },
    select: {
      id: true,
      name: true,
      title: true,
    },
  })

  const jacobRoomIds = new Set(memberships.map(m => m.roomId))
  const joinableRooms = allPublicRooms.filter(r => !jacobRoomIds.has(r.id))

  console.log(`\n📋 Public rooms jacob can join (${joinableRooms.length}):`)
  for (const room of joinableRooms) {
    console.log(`   🔓 ${room.name} (${room.title})`)
  }

  console.log('\n✅ Expected:')
  console.log('   - jacob should be in: #general, #tech, #random, #private-team, DM')
  console.log('   - jacob can join: #gaming, #music, #design')
}

checkSarah()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

