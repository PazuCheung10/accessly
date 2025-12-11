import { PrismaClient, Role, RoomRole, RoomType, TicketStatus } from '@prisma/client'

// Workaround for TypeScript not picking up TicketDepartment from Prisma client
// The enum exists in the generated client, but TypeScript cache may not see it
const TicketDepartment = {
  IT_SUPPORT: 'IT_SUPPORT',
  BILLING: 'BILLING',
  PRODUCT: 'PRODUCT',
  GENERAL: 'GENERAL',
} as const
type TicketDepartment = typeof TicketDepartment[keyof typeof TicketDepartment]
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
const announcementMessages = [
  'New feature release: Dark mode is now live! 🎉',
  'Reminder: All hands meeting this Friday at 2 PM',
  'Important: Database maintenance scheduled for this weekend',
  'Welcome to the team, everyone! Let\'s make this quarter great',
  'Update: New customer onboarding process is now in effect',
  'FYI: We\'ve updated our ticket SLA targets for Q1',
  'Announcement: New support agent training program starting next week',
  'Heads up: System will be in read-only mode during deployment',
  'Great news: We hit 1000 resolved tickets this month! 🚀',
  'Reminder: Please review the updated escalation procedures',
  'Update: New integration with our billing system is live',
  'Important: Customer data retention policy has been updated',
  'Welcome message: Thanks for being part of SolaceDesk!',
  'Quick update: Response time metrics are looking great this week',
  'Announcement: New help center articles published',
  'FYI: Holiday schedule posted in the calendar',
  'Update: Team performance dashboard is now available',
]

const engineeringMessages = [
  'We\'re seeing increased error rates on the login endpoint',
  'Deployment to production completed successfully',
  'Need to investigate the database query performance issue',
  'Just fixed a critical bug in the payment processing flow',
  'Anyone else seeing the Redis connection timeout errors?',
  'New monitoring alerts configured for ticket creation API',
  'Deployed hotfix for the password reset issue',
  'Performance optimization on the message loading query',
  'Investigating the spike in 500 errors from the support form',
  'Database migration completed, all systems green',
  'Need help debugging the WebSocket connection drops',
  'Code review: Please review the new ticket assignment logic',
]

const loungeMessages = [
  'Great job on closing that tricky billing ticket! 🎉',
  'Anyone up for lunch? Thinking about trying that new place',
  'Coffee break? I\'m heading to the kitchen',
  'Congrats to the team on hitting our response time goals!',
  'Weekend plans? I\'m thinking of going hiking',
  'Anyone else watching that new show? It\'s really good',
  'Thanks for the help with that customer issue today!',
  'Quick question: What\'s everyone\'s favorite productivity tool?',
  'Celebrating: We just hit our monthly ticket resolution target!',
  'Anyone want to grab coffee after work?',
]

const leadershipMessages = [
  'Let\'s review the high-priority tickets from this week',
  'Need to discuss the escalation process for billing issues',
  'Reviewing Q1 metrics: Response times are improving',
  'Decision needed: Should we prioritize the dark mode feature?',
  'Key insight: Most tickets are coming from the login flow',
  'Action item: Update our ticket assignment algorithm',
  'Review: Customer satisfaction scores are up 15% this month',
  'Discussion: How should we handle the increased ticket volume?',
]

const dmMessages = [
  'Can you take a look at the login ticket? Customer is waiting',
  'I\'ll handle the billing question, thanks for flagging it',
  'Quick question: Should we escalate this password reset ticket?',
  'Thanks for helping with that feature request ticket',
  'I\'ve assigned myself to the IT support ticket',
  'Can you review my response to the billing question?',
  'I\'ll follow up with the customer on the login issue',
  'Thanks for the quick turnaround on that ticket',
  'Let me know if you need help with any tickets',
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

  // Local Department enum to match schema (before migration)
  const Department = {
    IT_SUPPORT: 'IT_SUPPORT',
    BILLING: 'BILLING',
    PRODUCT: 'PRODUCT',
    DESIGN: 'DESIGN',
  } as const

  const users = [
    {
      email: 'admin@solace.com',
      name: 'Admin',
      role: Role.ADMIN,
      department: null, // Admins don't have a department (see all rooms)
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    },
    {
      email: 'clara@solace.com',
      name: 'Clara',
      role: Role.ADMIN,
      department: null, // Admins don't have a department (see all rooms)
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=clara',
    },
    {
      email: 'jacob@solace.com',
      name: 'Jacob',
      role: Role.USER,
      department: Department.IT_SUPPORT,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jacob',
    },
    {
      email: 'may@solace.com',
      name: 'May',
      role: Role.USER,
      department: Department.BILLING,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=may',
    },
    {
      email: 'ethan@solace.com',
      name: 'Ethan',
      role: Role.USER,
      department: Department.DESIGN,
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
      } as any, // Use 'as any' to work around TypeScript types not including department until migration is run
    })
    createdUsers.push(user)
    console.log(`   ✅ Created ${userData.role} user: ${userData.email}${userData.department ? ` (${userData.department})` : ''}`)
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
    '#announcements',
    '#engineering',
    '#team-lounge',
    '#leadership',
    `dm-${admin1.id}-${user1.id}`,
    '#customer-voice',
    '#billing-internal',
    '#ux-research',
    'ticket-login-issue',
    'ticket-billing-question',
    'ticket-feature-request',
    'ticket-password-reset',
  ]
  if (new Set(roomNames).size !== roomNames.length) {
    throw new Error('❌ Duplicate room names found in seed data')
  }

  const generalRoom = await prisma.room.create({
    data: {
      name: '#announcements',
      title: 'Company Announcements',
      description: 'Official updates from the SolaceDesk team and company-wide news.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      department: null, // PUBLIC_GLOBAL - visible to all
      creatorId: admin1.id,
      tags: ['announcements', 'company', 'updates'],
    } as any,
  })

  const techRoom = await prisma.room.create({
    data: {
      name: '#engineering',
      title: 'Engineering & Incidents',
      description: 'Discuss bugs, deployments, and technical incidents related to the product.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      department: Department.IT_SUPPORT, // Department-specific
      creatorId: admin1.id,
      tags: ['engineering', 'incidents', 'bugs', 'deployments'],
    } as any,
  })

  const randomRoom = await prisma.room.create({
    data: {
      name: '#team-lounge',
      title: 'Team Lounge',
      description: 'Casual conversations, celebrations, and off-topic chat for the team.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      department: null, // PUBLIC_GLOBAL - visible to all
      creatorId: admin2.id,
      tags: ['lounge', 'culture', 'off-topic'],
    } as any,
  })

  const privateRoom = await prisma.room.create({
    data: {
      name: '#leadership',
      title: 'Leadership Sync',
      description: 'Private space for leadership to review key tickets and product decisions.',
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
      description: 'Internal coordination about tickets and support issues.',
      type: RoomType.DM,
      isPrivate: true,
      creatorId: admin1.id,
      tags: [],
    },
  })

  // Joinable public rooms (jacob is NOT a member yet)
  const gamingRoom = await prisma.room.create({
    data: {
      name: '#customer-voice',
      title: 'Customer Voice',
      description: 'Share notable customer feedback, pain points, and success stories.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      department: null, // PUBLIC_GLOBAL - visible to all
      creatorId: admin2.id,
      tags: ['customers', 'feedback', 'voice-of-customer'],
    } as any,
  })

  const musicRoom = await prisma.room.create({
    data: {
      name: '#billing-internal',
      title: 'Billing & Accounts (Internal)',
      description: 'Internal discussions about billing edge cases, refunds, and account policies.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      department: Department.BILLING, // Department-specific
      creatorId: admin2.id,
      tags: ['billing', 'accounts', 'payments'],
    } as any,
  })

  const designRoom = await prisma.room.create({
    data: {
      name: '#ux-research',
      title: 'UX Research & Design',
      description: 'Collect UX feedback from tickets and discuss design improvements.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      department: Department.DESIGN, // Department-specific
      creatorId: admin1.id,
      tags: ['ux', 'design', 'research'],
    } as any,
  })

  // TICKET rooms with different departments
  // Using 'as any' to work around TypeScript types not including ticketDepartment until migration is run
  const ticketRoom1 = await prisma.room.create({
    data: {
      name: 'ticket-login-issue',
      title: '[TICKET][Login] Cannot log in after latest update',
      description: 'User cannot log in after the latest update',
      type: RoomType.TICKET,
      isPrivate: true,
      status: TicketStatus.OPEN,
      ticketDepartment: TicketDepartment.IT_SUPPORT,
      creatorId: user1.id,
      tags: ['ticket', 'bug', 'login'],
    } as any,
  })

  const ticketRoom2 = await prisma.room.create({
    data: {
      name: 'ticket-billing-question',
      title: '[TICKET][Billing] Question about subscription charges',
      description: 'Question about monthly subscription charges',
      type: RoomType.TICKET,
      isPrivate: true,
      status: TicketStatus.OPEN,
      ticketDepartment: TicketDepartment.BILLING,
      creatorId: user2.id,
      tags: ['ticket', 'billing', 'subscription'],
    } as any,
  })

  const ticketRoom3 = await prisma.room.create({
    data: {
      name: 'ticket-feature-request',
      title: '[TICKET][Feature] Dark mode toggle request',
      description: 'Request to add dark mode toggle in settings',
      type: RoomType.TICKET,
      isPrivate: true,
      status: TicketStatus.WAITING,
      ticketDepartment: TicketDepartment.PRODUCT,
      creatorId: user3.id,
      tags: ['ticket', 'feature', 'ui'],
    } as any,
  })

  const ticketRoom4 = await prisma.room.create({
    data: {
      name: 'ticket-password-reset',
      title: '[TICKET][Security] Need help resetting password',
      description: 'Unable to reset password via email link',
      type: RoomType.TICKET,
      isPrivate: true,
      status: TicketStatus.OPEN,
      ticketDepartment: TicketDepartment.IT_SUPPORT,
      creatorId: user1.id,
      tags: ['ticket', 'password', 'security'],
    } as any,
  })

  console.log(`✅ All ${roomNames.length} rooms created\n`)

  // ============================================
  // STEP 3: Create RoomMembers
  // ============================================
  console.log('👥 STEP 3: Adding members to rooms...')

  // PUBLIC_GLOBAL rooms (department === null): all users are members
  const publicGlobalRooms = [generalRoom, randomRoom, gamingRoom]
  const allUsers = [admin1, admin2, user1, user2, user3]
  
  for (const room of publicGlobalRooms) {
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
  console.log(`   ✅ Added all ${allUsers.length} users to ${publicGlobalRooms.length} PUBLIC_GLOBAL rooms`)

  // Department-specific rooms: auto-join users to their department room
  // IT_SUPPORT room (#engineering)
  const itSupportUsers = [user1] // Jacob
  for (const user of itSupportUsers) {
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: techRoom.id,
        role: user.id === techRoom.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  // Also add admins (they see all rooms)
  for (const admin of [admin1, admin2]) {
    await prisma.roomMember.create({
      data: {
        userId: admin.id,
        roomId: techRoom.id,
        role: admin.id === techRoom.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  console.log(`   ✅ Auto-joined IT_SUPPORT users to #engineering`)

  // BILLING room (#billing-internal)
  const billingUsers = [user2] // May
  for (const user of billingUsers) {
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: musicRoom.id,
        role: user.id === musicRoom.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  // Also add admins
  for (const admin of [admin1, admin2]) {
    await prisma.roomMember.create({
      data: {
        userId: admin.id,
        roomId: musicRoom.id,
        role: admin.id === musicRoom.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  console.log(`   ✅ Auto-joined BILLING users to #billing-internal`)

  // DESIGN room (#ux-research)
  const designUsers = [user3] // Ethan
  for (const user of designUsers) {
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: designRoom.id,
        role: user.id === designRoom.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  // Also add admins
  for (const admin of [admin1, admin2]) {
    await prisma.roomMember.create({
      data: {
        userId: admin.id,
        roomId: designRoom.id,
        role: admin.id === designRoom.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  console.log(`   ✅ Auto-joined DESIGN users to #ux-research`)

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

  // Ticket rooms: creator and assigned admin
  const ticketRooms = [ticketRoom1, ticketRoom2, ticketRoom3, ticketRoom4]
  const ticketCreators = [user1, user2, user3, user1]
  const ticketAdmins = [admin1, admin1, admin2, admin2]
  
  for (let i = 0; i < ticketRooms.length; i++) {
    await prisma.roomMember.create({
      data: { userId: ticketCreators[i].id, roomId: ticketRooms[i].id, role: RoomRole.MEMBER },
    })
    await prisma.roomMember.create({
      data: { userId: ticketAdmins[i].id, roomId: ticketRooms[i].id, role: RoomRole.OWNER },
    })
  }
  console.log(`   ✅ ${ticketRooms.length} ticket room members added\n`)

  // ============================================
  // STEP 4: Create Messages
  // ============================================
  console.log('💬 STEP 4: Generating messages...')
  console.log('   (Keeping total messages between 50-120 for optimal performance)\n')

  // Announcements room: 15 messages
  const generalMembers = [admin1, admin2, user1, user2, user3]
  const generalMessageIds: string[] = []
  for (let i = 0; i < 15; i++) {
    const randomUser = generalMembers[Math.floor(Math.random() * generalMembers.length)]
    const message = await prisma.message.create({
      data: {
        roomId: generalRoom.id,
        userId: randomUser.id,
        content: randomMessage(announcementMessages),
        createdAt: randomPastWeekDate(),
      },
    })
    generalMessageIds.push(message.id)
  }
  console.log(`   ✅ Generated 15 messages for Company Announcements`)

  // Engineering room: 12 messages
  const techMembers = [admin1, admin2, user1, user2]
  const techMessageIds: string[] = []
  for (let i = 0; i < 12; i++) {
    const randomUser = techMembers[Math.floor(Math.random() * techMembers.length)]
    const message = await prisma.message.create({
      data: {
        roomId: techRoom.id,
        userId: randomUser.id,
        content: randomMessage(engineeringMessages),
        createdAt: randomPastWeekDate(),
      },
    })
    techMessageIds.push(message.id)
  }
  console.log(`   ✅ Generated 12 messages for Engineering & Incidents`)

  // Team Lounge room: 10 messages
  const randomMembers = [user1, user2, user3, admin2]
  for (let i = 0; i < 10; i++) {
    const randomUser = randomMembers[Math.floor(Math.random() * randomMembers.length)]
    await prisma.message.create({
      data: {
        roomId: randomRoom.id,
        userId: randomUser.id,
        content: randomMessage(loungeMessages),
        createdAt: randomPastWeekDate(),
      },
    })
  }
  console.log(`   ✅ Generated 10 messages for Team Lounge`)

  // Leadership room: 8 messages
  const privateMembers = [admin1, admin2, user1]
  for (let i = 0; i < 8; i++) {
    const randomUser = privateMembers[Math.floor(Math.random() * privateMembers.length)]
    await prisma.message.create({
      data: {
        roomId: privateRoom.id,
        userId: randomUser.id,
        content: randomMessage(leadershipMessages),
        createdAt: randomPastWeekDate(),
      },
    })
  }
  console.log(`   ✅ Generated 8 messages for Leadership Sync`)

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

  // Ticket rooms: 1 main message per ticket + some replies
  const ticketMainMessages: string[] = []
  for (let i = 0; i < ticketRooms.length; i++) {
    const mainMessage = await prisma.message.create({
      data: {
        roomId: ticketRooms[i].id,
        userId: ticketCreators[i].id, // Creator
        content: randomMessage(ticketMessages),
        createdAt: randomPastWeekDate(),
      },
    })
    ticketMainMessages.push(mainMessage.id)
    
    // Add 2-3 replies per ticket
    const replyCount = i === 0 ? 3 : 2 // First ticket gets 3 replies, others get 2
    for (let j = 0; j < replyCount; j++) {
      const replyUser = j % 2 === 0 ? ticketAdmins[i] : ticketCreators[i] // Alternate between admin and creator
      await prisma.message.create({
        data: {
          roomId: ticketRooms[i].id,
          userId: replyUser.id,
          content: randomMessage(ticketReplies),
          parentMessageId: mainMessage.id,
          createdAt: randomPastWeekDate(),
        },
      })
    }
  }
  console.log(`   ✅ Generated ${ticketRooms.length} ticket messages with replies`)

  const totalMessages = 15 + 12 + 10 + 8 + 6 + ticketRooms.length + (3 + 2 + 2 + 2) // = 15+12+10+8+6+4+9 = 64 messages
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
  const allRooms = [generalRoom, techRoom, randomRoom, privateRoom, dmRoom, gamingRoom, musicRoom, designRoom, ...ticketRooms]
  for (const room of allRooms) {
    const roomMembers = await prisma.roomMember.count({
      where: { roomId: room.id },
    })
    if (roomMembers === 0) {
      throw new Error(`❌ Room ${room.name} has no members`)
    }
    console.log(`   ✅ ${room.name}: ${roomMembers} members`)
  }

  // Verify all ticket rooms have status and department
  for (const ticketRoom of ticketRooms) {
    const ticket = await prisma.room.findUnique({
      where: { id: ticketRoom.id },
      select: { type: true, status: true, ticketDepartment: true } as any,
    }) as any
    if (ticket?.type === RoomType.TICKET && !ticket.status) {
      throw new Error(`❌ Ticket room ${ticketRoom.name} missing status`)
    }
    if (ticket?.type === RoomType.TICKET && !ticket.ticketDepartment) {
      throw new Error(`❌ Ticket room ${ticketRoom.name} missing department`)
    }
  }
  console.log(`   ✅ All ${ticketRooms.length} ticket rooms have status and department`)

  // Verify all ticket rooms have messages
  for (let i = 0; i < ticketRooms.length; i++) {
    const messageCount = await prisma.message.count({
      where: { roomId: ticketRooms[i].id },
    })
    if (messageCount === 0) {
      throw new Error(`❌ Ticket room ${ticketRooms[i].name} (index ${i}) has no messages`)
    }
    console.log(`   ✅ Ticket ${i + 1} (${ticketRooms[i].name}): ${messageCount} messages`)
  }

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
