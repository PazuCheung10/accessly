import { PrismaClient, Role, RoomRole, RoomType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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
  'Does anyone know if there are any events happening this week?',
  'Great to see so many active members here!',
  'Thanks for all the help yesterday!',
  'Just wanted to say hi and introduce myself 🎉',
  'Anyone else working on something interesting this week?',
  'This is such a friendly community!',
  'Hope you all have a wonderful day! ✨',
  'I have a quick question - can anyone help?',
  'Thanks in advance!',
  'That sounds great!',
  'I totally agree with that',
  'Looking forward to hearing more about it',
  'That\'s really helpful, thanks!',
  'Does anyone have recommendations?',
  'I\'ll check that out!',
  'Sounds interesting!',
  'Thanks for sharing!',
]

const techMessages = [
  'Hey, has anyone tried the new Next.js 15 features?',
  'I just finished a project using React Server Components - it\'s amazing! 🚀',
  'Anyone working with TypeScript? I have a question about generics',
  'Just deployed my app to production - feels great!',
  'Does anyone have experience with Prisma migrations?',
  'I\'m learning Rust and it\'s quite different from what I\'m used to',
  'What\'s your favorite testing framework?',
  'Has anyone used Docker for local development?',
  'I love the new features in VS Code!',
  'Working on a new side project - excited to share it soon',
  'Anyone have tips for improving performance?',
  'Just read an interesting article about microservices',
  'I\'m trying to understand GraphQL subscriptions',
  'Does anyone have recommendations for state management?',
  'Learning about database indexing - it\'s fascinating!',
  'What\'s everyone working on this week?',
  'I found a great resource for learning Node.js',
  'Anyone using Tailwind CSS? I\'m loving it!',
  'Just set up CI/CD for my project 🎯',
  'What are your thoughts on serverless architecture?',
  'I\'m diving deep into WebSockets',
  'Anyone have experience with Redis?',
  'Just optimized my database queries - huge improvement!',
  'Learning about authentication best practices',
  'What\'s your go-to backend framework?',
]

const randomMessages = [
  'What\'s everyone up to this weekend? 🎉',
  'Just watched a great movie - anyone have recommendations?',
  'I love coffee ☕ - anyone else?',
  'What\'s your favorite programming language and why?',
  'Anyone else excited about the weekend?',
  'Just finished a great book!',
  'What\'s the weather like where you are?',
  'I\'m trying to learn a new language (not programming 😄)',
  'Anyone have good music recommendations?',
  'What\'s everyone\'s favorite hobby?',
  'Just had the best pizza ever 🍕',
  'Does anyone have pets?',
  'I\'m planning a trip - any travel tips?',
  'What\'s your favorite way to relax?',
  'Anyone else into photography?',
  'Just discovered a new coffee shop!',
  'What\'s everyone doing for lunch?',
  'I love hiking on weekends 🌲',
  'Anyone into gaming?',
  'What\'s your favorite season?',
  'Just learned something new today!',
  'Anyone have good podcast recommendations?',
  'What\'s your favorite cuisine?',
  'I\'m trying to get into better shape 💪',
  'Anyone have weekend plans?',
]

const privateMessages = [
  'Hey team! 👋',
  'Thanks for joining this private space',
  'Let\'s discuss the project details here',
  'I think we should focus on the MVP first',
  'What do you all think about the timeline?',
  'I\'ll send over the design mockups soon',
  'Great progress everyone!',
  'Let\'s schedule a meeting for next week',
  'I have some questions about the implementation',
  'Can we review the requirements together?',
  'This is looking really good!',
  'Thanks for all the hard work!',
  'I\'ll update the documentation today',
  'Let me know if you need any help',
  'Great collaboration everyone!',
  'I think we\'re on track',
  'Let\'s make sure we communicate clearly',
  'I appreciate everyone\'s input',
  'This is going to be awesome!',
  'Let\'s keep the momentum going!',
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
  'I\'ll get back to you on that',
  'Thanks again!',
  'Looking forward to working together',
  'Let me know if you need anything',
  'I\'ll send you the details',
  'Sounds great!',
  'Thanks for understanding',
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

// Generate random number between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log('🎭 Starting demo seed...')

  // Clear existing data (idempotent)
  console.log('🧹 Clearing existing data...')
  await prisma.message.deleteMany({})
  await prisma.roomMember.deleteMany({})
  await prisma.room.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('✅ Cleared existing data')

  // Hash password for all users
  const hashedPassword = await bcrypt.hash('demo123', 10)

  // Create 5 users (2 admins, 3 regular users) with avatars
  console.log('👥 Creating users...')
  
  const users = [
    {
      email: 'admin@demo.com',
      name: 'Alex Admin',
      role: Role.ADMIN,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    },
    {
      email: 'sarah@demo.com',
      name: 'Sarah Chen',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
    },
    {
      email: 'mike@demo.com',
      name: 'Mike Johnson',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mike',
    },
    {
      email: 'emma@demo.com',
      name: 'Emma Wilson',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma',
    },
    {
      email: 'david@demo.com',
      name: 'David Brown',
      role: Role.ADMIN,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david',
    },
  ]

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
    console.log(`✅ Created ${userData.role} user: ${userData.email}`)
  }

  const [admin1, user1, user2, user3, admin2] = createdUsers
  console.log('✅ All users created')
  console.log('   Password for all users: demo123')

  // Create 5 rooms: 3 public, 1 private, 1 DM
  console.log('🏠 Creating rooms...')

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
      name: `dm-${user1.id}-${user2.id}`,
      title: `DM: ${user1.name} & ${user2.name}`,
      description: null,
      type: RoomType.DM,
      isPrivate: true,
      creatorId: user1.id,
      tags: [],
    },
  })

  // Create additional public rooms that sarah (user1) is NOT a member of yet
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

  console.log('✅ All rooms created (including joinable rooms)')

  // Add members to rooms
  console.log('👥 Adding members to rooms...')

  // Public rooms: all users are members of the original 3
  const publicRooms = [generalRoom, techRoom, randomRoom]
  const allUsers = [admin1, user1, user2, user3, admin2]
  
  for (const room of publicRooms) {
    // Add all users to each public room
    for (const user of allUsers) {
      try {
        await prisma.roomMember.create({
          data: {
            userId: user.id,
            roomId: room.id,
            role: user.id === room.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
          },
        })
      } catch (error: any) {
        // Ignore duplicate key errors (idempotent)
        if (error.code !== 'P2002') {
          console.error(`Error adding ${user.email} to ${room.name}:`, error)
          throw error
        }
      }
    }
  }
  
  console.log(`✅ Added all ${allUsers.length} users to ${publicRooms.length} public rooms`)

  // New joinable rooms: add some users but NOT sarah (user1)
  // This creates rooms that sarah can discover and join
  const joinableRooms = [gamingRoom, musicRoom, designRoom]
  const usersForJoinable = [admin1, user2, user3, admin2] // Exclude user1 (sarah)
  
  for (const room of joinableRooms) {
    // Add creator as owner
    await prisma.roomMember.create({
      data: {
        userId: room.creatorId!,
        roomId: room.id,
        role: RoomRole.OWNER,
      },
    })
    
    // Add other users (but not sarah)
    for (const user of usersForJoinable) {
      if (user.id !== room.creatorId) {
        try {
          await prisma.roomMember.create({
            data: {
              userId: user.id,
              roomId: room.id,
              role: RoomRole.MEMBER,
            },
          })
        } catch (error: any) {
          if (error.code !== 'P2002') {
            console.error(`Error adding ${user.email} to ${room.name}:`, error)
            throw error
          }
        }
      }
    }
  }
  
  console.log(`✅ Created ${joinableRooms.length} joinable rooms (sarah can join these)`)

  // Private room: admin1 (owner), user1, user2 (members)
  await prisma.roomMember.create({
    data: {
      userId: admin1.id,
      roomId: privateRoom.id,
      role: RoomRole.OWNER,
    },
  })
  await prisma.roomMember.create({
    data: {
      userId: user1.id,
      roomId: privateRoom.id,
      role: RoomRole.MEMBER,
    },
  })
  await prisma.roomMember.create({
    data: {
      userId: user2.id,
      roomId: privateRoom.id,
      role: RoomRole.MODERATOR,
    },
  })

  // DM room: user1 and user2 (both members)
  await prisma.roomMember.create({
    data: {
      userId: user1.id,
      roomId: dmRoom.id,
      role: RoomRole.MEMBER,
    },
  })
  await prisma.roomMember.create({
    data: {
      userId: user2.id,
      roomId: dmRoom.id,
      role: RoomRole.MEMBER,
    },
  })

  console.log('✅ Members added to rooms')

  // Generate messages for each room
  console.log('💬 Generating messages...')

  // General room: 40 messages
  const generalMembers = [admin1, user1, user2, user3, admin2]
  for (let i = 0; i < 40; i++) {
    const randomUser = generalMembers[Math.floor(Math.random() * generalMembers.length)]
    await prisma.message.create({
      data: {
        roomId: generalRoom.id,
        userId: randomUser.id,
        content: randomMessage(generalMessages),
        createdAt: randomPastWeekDate(),
      },
    })
  }
  console.log(`✅ Generated ${40} messages for General Chat`)

  // Tech room: 35 messages
  const techMembers = [admin1, user1, user2, admin2]
  for (let i = 0; i < 35; i++) {
    const randomUser = techMembers[Math.floor(Math.random() * techMembers.length)]
    await prisma.message.create({
      data: {
        roomId: techRoom.id,
        userId: randomUser.id,
        content: randomMessage(techMessages),
        createdAt: randomPastWeekDate(),
      },
    })
  }
  console.log(`✅ Generated ${35} messages for Tech Talk`)

  // Random room: 30 messages
  const randomMembers = [user1, user2, user3, admin2]
  for (let i = 0; i < 30; i++) {
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
  console.log(`✅ Generated ${30} messages for Random`)

  // Private room: 25 messages
  const privateMembers = [admin1, user1, user2]
  for (let i = 0; i < 25; i++) {
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
  console.log(`✅ Generated ${25} messages for Private Team Room`)

  // DM room: 20 messages
  const dmMembers = [user1, user2]
  for (let i = 0; i < 20; i++) {
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
  console.log(`✅ Generated ${20} messages for DM`)

  // Verify seed data
  console.log('\n🔍 Verifying seed data...')
  const totalRooms = await prisma.room.count()
  const totalMessages = await prisma.message.count()
  const totalMemberships = await prisma.roomMember.count()
  
  console.log(`   Rooms: ${totalRooms}`)
  console.log(`   Messages: ${totalMessages}`)
  console.log(`   Memberships: ${totalMemberships}`)
  
  // Verify each user has memberships
  for (const user of allUsers) {
    const userMemberships = await prisma.roomMember.count({
      where: { userId: user.id },
    })
    console.log(`   ${user.email}: ${userMemberships} room memberships`)
  }
  
  // Verify each room has members
  const allRoomsToCheck = [...publicRooms, ...joinableRooms]
  for (const room of allRoomsToCheck) {
    const roomMembers = await prisma.roomMember.count({
      where: { roomId: room.id },
    })
    const roomMessages = await prisma.message.count({
      where: { roomId: room.id },
    })
    console.log(`   ${room.name}: ${roomMembers} members, ${roomMessages} messages`)
  }
  
  // Check which rooms sarah (user1) can join
  const sarahJoinable = await prisma.room.findMany({
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
  console.log(`\n   📋 Rooms sarah can join: ${sarahJoinable.length}`)
  for (const room of sarahJoinable) {
    console.log(`      - ${room.name} (${room.title})`)
  }

  console.log('\n✨ Demo seed completed!')
  console.log('\n📋 Demo Accounts:')
  console.log('   Admin: admin@demo.com / demo123')
  console.log('   Admin: david@demo.com / demo123')
  console.log('   User:  sarah@demo.com / demo123')
  console.log('   User:  mike@demo.com / demo123')
  console.log('   User:  emma@demo.com / demo123')
  console.log('\n🎉 You can now sign in with any account and see the chat history!')
  console.log('\n⚠️  IMPORTANT: Make sure you sign in with one of the demo accounts above!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

