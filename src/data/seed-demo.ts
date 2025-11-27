import { PrismaClient, Role, RoomRole, RoomType, TicketStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * IMPORTANT SEEDING RULES:
 * 
 * 1. Never skip validation:
 *    - Rooms exist before creating messages
 *    - RoomMembers exist before creating messages
 *    - parentMessageId references a message in the same room
 *    - Ticket rooms must include a valid status
 *    - All emails must be unique
 *    - Room names must be unique
 * 
 * 2. Create items in this order:
 *    1. Users
 *    2. Rooms
 *    3. RoomMembers
 *    4. Messages
 * 
 * 3. Keep messages realistic (50-120 total)
 * 
 * 4. Match the app logic:
 *    - room.type must be: "PUBLIC" | "PRIVATE" | "DM" | "TICKET"
 *    - For TICKET rooms, set status: "OPEN" | "WAITING" | "RESOLVED"
 */

// Sample messages for different room types
const generalMessages = [
  'Hey everyone! 👋',
  'Good morning! How is everyone doing today?',
  'Just checking in - hope everyone has a great week!',
  'Anyone up for a quick chat?',
  'I love this community! 💙',
  'Thanks for the warm welcome everyone!',
  'Has anyone tried the new feature yet?',
  'Looking forward to the weekend!',
  'Great to see so many active members here!',
  'Thanks for all the help yesterday!',
  'Just wanted to say hi and introduce myself 🎉',
  'This is such a friendly community!',
  'Hope you all have a wonderful day! ✨',
  'I have a quick question - can anyone help?',
  'That sounds great!',
  'I totally agree with that',
  'Thanks for sharing!',
]

const techMessages = [
  'Hey, has anyone tried the new Next.js 15 features?',
  'I just finished a project using React Server Components - it\'s amazing! 🚀',
  'Anyone working with TypeScript? I have a question about generics',
  'Just deployed my app to production - feels great!',
  'Does anyone have experience with Prisma migrations?',
  'What\'s your favorite testing framework?',
  'Has anyone used Docker for local development?',
  'I love the new features in VS Code!',
  'Anyone have tips for improving performance?',
  'Just read an interesting article about microservices',
  'Does anyone have recommendations for state management?',
  'Learning about database indexing - it\'s fascinating!',
]

const randomMessages = [
  'What\'s everyone up to this weekend? 🎉',
  'Just watched a great movie - anyone have recommendations?',
  'I love coffee ☕ - anyone else?',
  'What\'s your favorite programming language and why?',
  'Just finished a great book!',
  'What\'s the weather like where you are?',
  'Anyone have good music recommendations?',
  'What\'s everyone\'s favorite hobby?',
  'Just had the best pizza ever 🍕',
  'I\'m planning a trip - any travel tips?',
]

const privateMessages = [
  'Hey team! 👋',
  'Thanks for joining this private space',
  'Let\'s discuss the project details here',
  'I think we should focus on the MVP first',
  'What do you all think about the timeline?',
  'Great progress everyone!',
  'Let\'s schedule a meeting for next week',
  'I have some questions about the implementation',
  'This is looking really good!',
  'Thanks for all the hard work!',
]

const dmMessages = [
  'Hey! How are you doing?',
  'Thanks for reaching out!',
  'I wanted to ask you about something',
  'Do you have a moment to chat?',
  'I appreciate your help with this',
  'Thanks for the quick response!',
  'Let me know what you think',
  'That sounds good to me',
  'Thanks again!',
]

const ticketMessages = [
  'I\'m experiencing an issue with the login functionality',
  'The app crashes when I try to upload a file',
  'Can you help me reset my password?',
  'I noticed a bug in the search feature',
  'Is there a way to export my data?',
]

const ticketReplies = [
  'Thanks for reporting this. Let me investigate.',
  'I\'ve reproduced the issue and working on a fix.',
  'This should be resolved in the next update.',
  'Can you provide more details about when this happens?',
  'I\'ll update you once we have a solution.',
]

// Generate random timestamp within past week
function randomPastWeekDate(): Date {
  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const randomTime = Math.random() * (now - weekAgo) + weekAgo
  return new Date(randomTime)
}

// Generate random message from array
function randomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]
}

async function main() {
  console.log('🎭 Starting demo seed...')
  console.log('📋 Following seeding rules: Users → Rooms → RoomMembers → Messages\n')

  // Clear existing data (idempotent) - in reverse order of creation
  console.log('🧹 Clearing existing data...')
  await prisma.message.deleteMany({})
  await prisma.roomMember.deleteMany({})
  await prisma.room.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('✅ Cleared existing data\n')

  // ============================================
  // STEP 1: Create Users
  // ============================================
  console.log('👥 STEP 1: Creating users...')
  
  // Hash password for all users
  const hashedPassword = await bcrypt.hash('demo123', 10)

  const users = [
    {
      email: 'admin@solace.com',
      name: 'Admin',
      role: Role.ADMIN,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    },
    {
      email: 'clara@solace.com',
      name: 'Clara',
      role: Role.ADMIN,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=clara',
    },
    {
      email: 'jacob@solace.com',
      name: 'Jacob',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jacob',
    },
    {
      email: 'may@solace.com',
      name: 'May',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=may',
    },
    {
      email: 'ethan@solace.com',
      name: 'Ethan',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ethan',
    },
  ]

  // Validate: All emails must be unique
  const emails = users.map(u => u.email)
  if (new Set(emails).size !== emails.length) {
    throw new Error('❌ Duplicate emails found in seed data')
  }

  const createdUsers = []
  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        emailVerified: new Date(),
      },
    })
    createdUsers.push(user)
    console.log(`   ✅ Created ${userData.role} user: ${userData.email}`)
  }

  const [admin1, admin2, user1, user2, user3] = createdUsers
  console.log(`✅ All ${createdUsers.length} users created`)
  console.log('   Password for all users: demo123\n')

  // ============================================
  // STEP 2: Create Rooms
  // ============================================
  console.log('🏠 STEP 2: Creating rooms...')

  // Validate: All room names must be unique
  const roomNames = [
    '#general',
    '#tech',
    '#random',
    '#private-team',
    `dm-${admin1.id}-${user1.id}`,
    '#gaming',
    '#music',
    '#design',
    'ticket-login-issue',
  ]
  if (new Set(roomNames).size !== roomNames.length) {
    throw new Error('❌ Duplicate room names found in seed data')
  }

  const generalRoom = await prisma.room.create({
    data: {
      name: '#general',
      title: 'General Chat',
      description: 'Welcome to our general discussion room! Say hi and introduce yourself.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      creatorId: admin1.id,
      tags: ['general', 'chat', 'community', 'welcome'],
    },
  })

  const techRoom = await prisma.room.create({
    data: {
      name: '#tech',
      title: 'Tech Talk',
      description: 'Discuss technology, programming, and all things tech!',
      type: RoomType.PUBLIC,
      isPrivate: false,
      creatorId: admin1.id,
      tags: ['tech', 'programming', 'development', 'coding'],
    },
  })

  const randomRoom = await prisma.room.create({
    data: {
      name: '#random',
      title: 'Random',
      description: 'Off-topic discussions and random conversations.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      creatorId: admin2.id,
      tags: ['random', 'off-topic', 'fun', 'chat'],
    },
  })

  const privateRoom = await prisma.room.create({
    data: {
      name: '#private-team',
      title: 'Private Team Room',
      description: 'Private discussion space for team members only.',
      type: RoomType.PRIVATE,
      isPrivate: true,
      creatorId: admin1.id,
      tags: ['private', 'team'],
    },
  })

  const dmRoom = await prisma.room.create({
    data: {
      name: `dm-${admin1.id}-${user1.id}`,
      title: `DM: ${admin1.name} & ${user1.name}`,
      description: null,
      type: RoomType.DM,
      isPrivate: true,
      creatorId: admin1.id,
      tags: [],
    },
  })

  // Joinable public rooms (jacob is NOT a member yet)
  const gamingRoom = await prisma.room.create({
    data: {
      name: '#gaming',
      title: 'Gaming Hub',
      description: 'Discuss your favorite games, share tips, and find teammates!',
      type: RoomType.PUBLIC,
      isPrivate: false,
      creatorId: admin2.id,
      tags: ['gaming', 'esports', 'multiplayer'],
    },
  })

  const musicRoom = await prisma.room.create({
    data: {
      name: '#music',
      title: 'Music Lovers',
      description: 'Share your favorite tracks, discover new artists, and talk about music!',
      type: RoomType.PUBLIC,
      isPrivate: false,
      creatorId: admin2.id,
      tags: ['music', 'artists', 'playlists'],
    },
  })

  const designRoom = await prisma.room.create({
    data: {
      name: '#design',
      title: 'Design & Art',
      description: 'Showcase your designs, get feedback, and discuss art trends.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      creatorId: admin1.id,
      tags: ['design', 'art', 'ui', 'ux'],
    },
  })

  // TICKET room with proper status
  const ticketRoom = await prisma.room.create({
    data: {
      name: 'ticket-login-issue',
      title: '[TICKET] Login issue after update',
      description: 'User cannot log in after the latest update',
      type: RoomType.TICKET,
      isPrivate: false,
      status: TicketStatus.OPEN, // Required for TICKET rooms
      creatorId: user1.id,
      tags: ['ticket', 'bug', 'login'],
    },
  })

  console.log(`✅ All ${roomNames.length} rooms created\n`)

  // ============================================
  // STEP 3: Create RoomMembers
  // ============================================
  console.log('👥 STEP 3: Adding members to rooms...')

  // Public rooms: all users are members
  const publicRooms = [generalRoom, techRoom, randomRoom]
  const allUsers = [admin1, admin2, user1, user2, user3]
  
  for (const room of publicRooms) {
    for (const user of allUsers) {
      await prisma.roomMember.create({
        data: {
          userId: user.id,
          roomId: room.id,
          role: user.id === room.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
        },
      })
    }
  }
  console.log(`   ✅ Added all ${allUsers.length} users to ${publicRooms.length} public rooms`)

  // Joinable rooms: add some users but NOT jacob (user1)
  const joinableRooms = [gamingRoom, musicRoom, designRoom]
  const usersForJoinable = [admin1, admin2, user2, user3] // Exclude user1 (jacob)
  
  for (const room of joinableRooms) {
    await prisma.roomMember.create({
      data: {
        userId: room.creatorId!,
        roomId: room.id,
        role: RoomRole.OWNER,
      },
    })
    
    for (const user of usersForJoinable) {
      if (user.id !== room.creatorId) {
        await prisma.roomMember.create({
          data: {
            userId: user.id,
            roomId: room.id,
            role: RoomRole.MEMBER,
          },
        })
      }
    }
  }
  console.log(`   ✅ Created ${joinableRooms.length} joinable rooms (jacob can join these)`)

  // Private room: admin1 (owner), admin2, user1 (members)
  await prisma.roomMember.create({
    data: { userId: admin1.id, roomId: privateRoom.id, role: RoomRole.OWNER },
  })
  await prisma.roomMember.create({
    data: { userId: admin2.id, roomId: privateRoom.id, role: RoomRole.MEMBER },
  })
  await prisma.roomMember.create({
    data: { userId: user1.id, roomId: privateRoom.id, role: RoomRole.MODERATOR },
  })
  console.log('   ✅ Private room members added')

  // DM room: admin1 and user1 (both members)
  await prisma.roomMember.create({
    data: { userId: admin1.id, roomId: dmRoom.id, role: RoomRole.MEMBER },
  })
  await prisma.roomMember.create({
    data: { userId: user1.id, roomId: dmRoom.id, role: RoomRole.MEMBER },
  })
  console.log('   ✅ DM room members added')

  // Ticket room: creator (user1) and assigned admin (admin1)
  await prisma.roomMember.create({
    data: { userId: user1.id, roomId: ticketRoom.id, role: RoomRole.MEMBER },
  })
  await prisma.roomMember.create({
    data: { userId: admin1.id, roomId: ticketRoom.id, role: RoomRole.OWNER },
  })
  console.log('   ✅ Ticket room members added\n')

  // ============================================
  // STEP 4: Create Messages
  // ============================================
  console.log('💬 STEP 4: Generating messages...')
  console.log('   (Keeping total messages between 50-120 for optimal performance)\n')

  // General room: 15 messages
  const generalMembers = [admin1, admin2, user1, user2, user3]
  const generalMessageIds: string[] = []
  for (let i = 0; i < 15; i++) {
    const randomUser = generalMembers[Math.floor(Math.random() * generalMembers.length)]
    const message = await prisma.message.create({
      data: {
        roomId: generalRoom.id,
        userId: randomUser.id,
        content: randomMessage(generalMessages),
        createdAt: randomPastWeekDate(),
      },
    })
    generalMessageIds.push(message.id)
  }
  console.log(`   ✅ Generated 15 messages for General Chat`)

  // Tech room: 12 messages
  const techMembers = [admin1, admin2, user1, user2]
  const techMessageIds: string[] = []
  for (let i = 0; i < 12; i++) {
    const randomUser = techMembers[Math.floor(Math.random() * techMembers.length)]
    const message = await prisma.message.create({
      data: {
        roomId: techRoom.id,
        userId: randomUser.id,
        content: randomMessage(techMessages),
        createdAt: randomPastWeekDate(),
      },
    })
    techMessageIds.push(message.id)
  }
  console.log(`   ✅ Generated 12 messages for Tech Talk`)

  // Random room: 10 messages
  const randomMembers = [user1, user2, user3, admin2]
  for (let i = 0; i < 10; i++) {
    const randomUser = randomMembers[Math.floor(Math.random() * randomMembers.length)]
    await prisma.message.create({
      data: {
        roomId: randomRoom.id,
        userId: randomUser.id,
        content: randomMessage(randomMessages),
        createdAt: randomPastWeekDate(),
      },
    })
  }
  console.log(`   ✅ Generated 10 messages for Random`)

  // Private room: 8 messages
  const privateMembers = [admin1, admin2, user1]
  for (let i = 0; i < 8; i++) {
    const randomUser = privateMembers[Math.floor(Math.random() * privateMembers.length)]
    await prisma.message.create({
      data: {
        roomId: privateRoom.id,
        userId: randomUser.id,
        content: randomMessage(privateMessages),
        createdAt: randomPastWeekDate(),
      },
    })
  }
  console.log(`   ✅ Generated 8 messages for Private Team Room`)

  // DM room: 6 messages
  const dmMembers = [admin1, user1]
  for (let i = 0; i < 6; i++) {
    const randomUser = dmMembers[Math.floor(Math.random() * dmMembers.length)]
    await prisma.message.create({
      data: {
        roomId: dmRoom.id,
        userId: randomUser.id,
        content: randomMessage(dmMessages),
        createdAt: randomPastWeekDate(),
      },
    })
  }
  console.log(`   ✅ Generated 6 messages for DM`)

  // Ticket room: 1 main message + 5 replies (threaded)
  const ticketMainMessage = await prisma.message.create({
    data: {
      roomId: ticketRoom.id,
      userId: user1.id, // Creator
      content: randomMessage(ticketMessages),
      createdAt: randomPastWeekDate(),
    },
  })
  console.log(`   ✅ Generated 1 main message for Ticket`)

  // Create threaded replies (parentMessageId references main message in same room)
  for (let i = 0; i < 5; i++) {
    const replyUser = i % 2 === 0 ? admin1 : user1 // Alternate between admin and user
    await prisma.message.create({
      data: {
        roomId: ticketRoom.id, // Same room as parent
        userId: replyUser.id,
        content: randomMessage(ticketReplies),
        parentMessageId: ticketMainMessage.id, // Valid reference to message in same room
        createdAt: randomPastWeekDate(),
      },
    })
  }
  console.log(`   ✅ Generated 5 threaded replies for Ticket`)

  const totalMessages = 15 + 12 + 10 + 8 + 6 + 1 + 5 // = 57 messages
  console.log(`\n   📊 Total messages: ${totalMessages} (within 50-120 range)`)

  // ============================================
  // STEP 5: Verification
  // ============================================
  console.log('\n🔍 STEP 5: Verifying seed data...')
  
  // Verify counts
  const totalRooms = await prisma.room.count()
  const totalMessagesCount = await prisma.message.count()
  const totalMemberships = await prisma.roomMember.count()
  
  console.log(`   ✅ Rooms: ${totalRooms}`)
  console.log(`   ✅ Messages: ${totalMessagesCount}`)
  console.log(`   ✅ Memberships: ${totalMemberships}`)
  
  // Verify each user has memberships
  for (const user of allUsers) {
    const userMemberships = await prisma.roomMember.count({
      where: { userId: user.id },
    })
    if (userMemberships === 0) {
      throw new Error(`❌ User ${user.email} has no room memberships`)
    }
    console.log(`   ✅ ${user.email}: ${userMemberships} room memberships`)
  }
  
  // Verify each room has members
  const allRooms = [generalRoom, techRoom, randomRoom, privateRoom, dmRoom, ...joinableRooms, ticketRoom]
  for (const room of allRooms) {
    const roomMembers = await prisma.roomMember.count({
      where: { roomId: room.id },
    })
    if (roomMembers === 0) {
      throw new Error(`❌ Room ${room.name} has no members`)
    }
    console.log(`   ✅ ${room.name}: ${roomMembers} members`)
  }

  // Verify ticket room has status
  const ticket = await prisma.room.findUnique({
    where: { id: ticketRoom.id },
    select: { type: true, status: true },
  })
  if (ticket?.type === RoomType.TICKET && !ticket.status) {
    throw new Error(`❌ Ticket room ${ticketRoom.name} missing status`)
  }
  console.log(`   ✅ Ticket room has status: ${ticket?.status}`)

  // Verify parentMessageId references are valid
  const messagesWithParent = await prisma.message.findMany({
    where: { parentMessageId: { not: null } },
    select: { id: true, roomId: true, parentMessageId: true },
  })
  for (const msg of messagesWithParent) {
    const parent = await prisma.message.findUnique({
      where: { id: msg.parentMessageId! },
      select: { roomId: true },
    })
    if (!parent) {
      throw new Error(`❌ Message ${msg.id} references non-existent parent ${msg.parentMessageId}`)
    }
    if (parent.roomId !== msg.roomId) {
      throw new Error(`❌ Message ${msg.id} parent is in different room`)
    }
  }
  console.log(`   ✅ All ${messagesWithParent.length} threaded messages have valid parent references`)

  // Check which rooms jacob (user1) can join
  const jacobJoinable = await prisma.room.findMany({
    where: {
      type: RoomType.PUBLIC,
      members: {
        none: {
          userId: user1.id,
        },
      },
    },
    select: {
      name: true,
      title: true,
    },
  })
  console.log(`\n   📋 Rooms jacob can join: ${jacobJoinable.length}`)
  for (const room of jacobJoinable) {
    console.log(`      - ${room.name} (${room.title})`)
  }

  console.log('\n✨ Demo seed completed successfully!')
  console.log('\n📋 Demo Accounts:')
  console.log('   Admin: admin@solace.com / demo123')
  console.log('   Admin: clara@solace.com / demo123')
  console.log('   User:  jacob@solace.com / demo123')
  console.log('   User:  may@solace.com / demo123')
  console.log('   User:  ethan@solace.com / demo123')
  console.log('\n🎉 You can now sign in with any account and see the chat history!')
  console.log('\n💡 Next steps:')
  console.log('   - Sign in at http://localhost:3000')
  console.log('   - Verify endpoints: /api/debug/session, /api/chat/rooms')
  console.log('   - Check ticket room: ticket-login-issue')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
