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

// Extra chat samples so every visible room feels "alive"
const billingMessages = [
  'Heads up: we got a question about an unexpected prorated charge — can someone sanity check the timeline?',
  'Refund policy reminder: if it’s within 14 days and unused, we can process without escalation.',
  'Chargeback came in for invoice #4821 — I’m pulling the receipt + usage logs now.',
  'We should add a help-center snippet for “Why was I charged twice?” (usually pending auth + capture).',
  'FYI: finance asked us to tag “refund” vs “credit” more consistently in ticket notes.',
  'Can we confirm whether annual upgrades are billed immediately or at renewal? Docs look outdated.',
  'I’ll draft a macro reply for “invoice PDF request” — we get this a lot.',
]

const productMessages = [
  'Quick pulse: onboarding step “Connect Workspace” is still where most drop-offs happen.',
  'If we add a dark mode toggle, we should also ship an “auto (system)” option.',
  'Can we get a quick UX review on the ticket status dropdown? Users keep missing “Waiting”.',
  'Feature request roundup: saved searches + notification rules are trending.',
  'I’m collecting quotes for #customer-voice — please drop notable feedback (no PII).',
  'For next sprint: I’d like to ship “Assign to me” on tickets and reduce clicks.',
  'Roadmap note: demo mode should stay read-only but browseable across PUBLIC rooms.',
]

const generalDiscussionMessages = [
  'Morning! Anything blocking today?',
  'PSA: if you’re on-call this week, please keep an eye on the auth error dashboard.',
  'Reminder: keep customer names out of public rooms — use ticket IDs instead.',
  'Small win: median first response time is down since last week.',
  'If anyone wants to pair on “search relevance”, I’m free after 3pm.',
  'Shoutout to Billing for untangling that upgrade issue so quickly.',
  'We should do a 15-min demo of the new moderation tools on Friday.',
]

const customerVoiceMessages = [
  '“Love the speed of support — felt human.” (from last week’s survey)',
  'Customer asks for “status page subscriptions” — they want proactive incident emails.',
  'Feedback theme: “I can’t find my invoices easily” keeps coming up.',
  'Positive note: several users called out the new ticket summaries as “super helpful”.',
  'Request: “Slack notifications for ticket updates” — multiple +1s.',
  'Pain point: password reset emails sometimes land in spam for some domains.',
  'Someone asked if we can export ticket history as CSV/PDF for audits.',
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

// Realistic ticket conversations
const ticketConversations = [
  // IT Support - Login Issue
  {
    initial: 'User reported they cannot log in after the latest update. They\'ve tried clearing cache and cookies but still getting authentication errors.',
    responses: [
      'Thanks for creating this ticket. I\'ll investigate the login issue right away.',
      'I\'ve checked the logs and found the issue - it\'s related to session management after the update. Working on a fix now.',
      'I\'ve deployed a hotfix. Can you ask the user to try logging in again?',
    ],
  },
  // Billing - Subscription Question
  {
    initial: 'User has questions about their subscription charges. They see a charge but aren\'t sure what it\'s for.',
    responses: [
      'I\'ll review their account and billing history to clarify the charges.',
      'I found the charge - it\'s for the annual plan upgrade they requested last month. I\'ve sent them a detailed breakdown via email.',
      'User confirmed they understand now. Ticket can be closed.',
    ],
  },
  // Product - Feature Request
  {
    initial: 'Feature request: User wants a dark mode toggle in settings. This has been requested multiple times.',
    responses: [
      'I\'ve added this to our product backlog. We\'ll discuss priority in the next sprint planning.',
      'Update: This feature is now planned for Q2 release. I\'ll keep the user updated.',
    ],
  },
  // IT Support - Password Reset
  {
    initial: 'User unable to reset password via email link. The link appears to expire too quickly or not arrive at all.',
    responses: [
      'I\'ll check the email delivery system and password reset flow.',
      'Found the issue - email links were expiring after 15 minutes instead of 24 hours. I\'ve fixed the configuration.',
      'I\'ve manually reset their password and sent them a new temporary password. They should be able to log in now.',
    ],
  },
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

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60 * 1000)
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log('🎭 Starting demo seed...')
  console.log('📋 Following seeding rules: Users → Rooms → RoomMembers → Messages\n')
  
  // Log Prisma client version
  console.log('🧬 Prisma client version:', (prisma as any)._clientVersion || 'unknown')

  // Clear existing data (idempotent) - in reverse order of creation
  console.log('🧹 Clearing existing data...')
  await prisma.message.deleteMany({})
  await prisma.roomMember.deleteMany({})
  await prisma.room.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('✅ Cleared existing data')

  // Update Department enum to ensure it has the correct values
  // Note: This will be handled by Prisma schema sync, so we just ensure data is cleared

  // ============================================
  // STEP 1: Create Users
  // ============================================
  console.log('👥 STEP 1: Creating users...')
  
  // Hash password for all users
  // DEBUG: Log bcrypt module info in seed
  console.log('🌱 Seed: Using bcrypt library: bcryptjs')
  try {
    const bcryptModule = await import('bcryptjs')
    console.log('🌱 Seed: bcrypt module loaded:', typeof bcryptModule.default === 'function' ? 'default export' : 'named export')
    console.log('🌱 Seed: bcrypt.hash type:', typeof bcrypt.hash)
  } catch (e) {
    console.error('🌱 Seed: Failed to inspect bcrypt module:', e)
  }
  const hashedPassword = await bcrypt.hash('demo123', 10)
  console.log('🌱 Seed: Generated hash prefix:', hashedPassword.substring(0, 20))

  // Local Department enum to match schema (before migration)
  const Department = {
    ENGINEERING: 'ENGINEERING',
    BILLING: 'BILLING',
    PRODUCT: 'PRODUCT',
    GENERAL: 'GENERAL',
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
    // ENGINEERING department: 1 head + 2 members
    {
      email: 'jacob@solace.com',
      name: 'Jacob',
      role: Role.USER,
      department: Department.ENGINEERING, // Department head
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jacob',
    },
    {
      email: 'alex@solace.com',
      name: 'Alex',
      role: Role.USER,
      department: Department.ENGINEERING, // Member
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    },
    {
      email: 'sam@solace.com',
      name: 'Sam',
      role: Role.USER,
      department: Department.ENGINEERING, // Member
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sam',
    },
    // BILLING department: 1 head + 2 members
    {
      email: 'may@solace.com',
      name: 'May',
      role: Role.USER,
      department: Department.BILLING, // Department head
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=may',
    },
    {
      email: 'lisa@solace.com',
      name: 'Lisa',
      role: Role.USER,
      department: Department.BILLING, // Member
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lisa',
    },
    {
      email: 'tom@solace.com',
      name: 'Tom',
      role: Role.USER,
      department: Department.BILLING, // Member
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tom',
    },
    // PRODUCT department: 1 head + 2 members
    {
      email: 'ethan@solace.com',
      name: 'Ethan',
      role: Role.USER,
      department: Department.PRODUCT, // Department head
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ethan',
    },
    {
      email: 'sarah@solace.com',
      name: 'Sarah',
      role: Role.USER,
      department: Department.PRODUCT, // Member
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
    },
    {
      email: 'david@solace.com',
      name: 'David',
      role: Role.USER,
      department: Department.PRODUCT, // Member
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david',
    },
    // GENERAL department: 1 head + 2 members
    {
      email: 'mike@solace.com',
      name: 'Mike',
      role: Role.USER,
      department: Department.GENERAL, // Department head
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mike',
    },
    {
      email: 'emma@solace.com',
      name: 'Emma',
      role: Role.USER,
      department: Department.GENERAL, // Member
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma',
    },
    {
      email: 'chris@solace.com',
      name: 'Chris',
      role: Role.USER,
      department: Department.GENERAL, // Member
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=chris',
    },
    // External customers removed - internal-only system
  ]

  // Create demo observer user (read-only for public demo)
  const demoObserverPassword = await bcrypt.hash('demo123', 10)
  const demoObserver = await prisma.user.upsert({
    where: { email: 'demo@solace.com' },
    update: {
      password: demoObserverPassword,
      name: 'Demo Observer',
      // Stable "girl" avatar for demo user
      image: '/avatars/demo-sophia.svg',
      role: Role.DEMO_OBSERVER, // Ensure role is set correctly
    },
    create: {
      email: 'demo@solace.com',
      name: 'Demo Observer',
      emailVerified: new Date(),
      role: Role.DEMO_OBSERVER,
      password: demoObserverPassword,
      // Stable "girl" avatar for demo user
      image: '/avatars/demo-sophia.svg',
    },
  })
  console.log('✅ Created demo observer user:', demoObserver.email)
  console.log('   Password: demo123')
  console.log('   Role: DEMO_OBSERVER (read-only)')

  // Validate: All emails must be unique
  const emails = users.map(u => u.email)
  emails.push('demo@solace.com')
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

  const [admin1, admin2, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, user11, user12] = createdUsers
  // Department heads: user1 (ENGINEERING), user4 (BILLING), user7 (PRODUCT), user10 (GENERAL)
  // External customers removed - internal-only system
  console.log(`✅ All ${createdUsers.length} users created`)
  console.log('   Password for all users: demo123\n')

  // ============================================
  // STEP 2: Create Rooms
  // ============================================
  console.log('🏠 STEP 2: Creating rooms...')

  // Validate: All room names must be unique
  // Note: admin1 and user1 IDs will be available after user creation
  const roomNames = [
    '#announcements',
    '#engineering',
    '#team-lounge',
    '#leadership',
    '#customer-voice',
    '#billing-internal',
    '#product',
    '#general',
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
      department: Department.ENGINEERING, // Department-specific
      creatorId: user1.id, // Department head creates the room
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
      department: null, // PRIVATE rooms don't have department
      creatorId: admin1.id, // Department head creates private room
      tags: ['private', 'team'],
    } as any,
  })

  // DM room removed per requirements (no DM feature)

  // Joinable public rooms
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

  const billingRoom = await prisma.room.create({
    data: {
      name: '#billing-internal',
      title: 'Billing & Accounts (Internal)',
      description: 'Internal discussions about billing edge cases, refunds, and account policies.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      department: Department.BILLING, // Department-specific
      creatorId: user4.id, // Department head creates the room
      tags: ['billing', 'accounts', 'payments'],
    } as any,
  })

  const productRoom = await prisma.room.create({
    data: {
      name: '#product',
      title: 'Product & Features',
      description: 'Discuss product features, roadmaps, and user feedback.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      department: Department.PRODUCT, // Department-specific
      creatorId: user7.id, // Department head creates the room
      tags: ['product', 'features', 'roadmap'],
    } as any,
  })

  const generalRoom2 = await prisma.room.create({
    data: {
      name: '#general',
      title: 'General Discussion',
      description: 'General team discussions and cross-department collaboration.',
      type: RoomType.PUBLIC,
      isPrivate: false,
      department: Department.GENERAL, // Department-specific
      creatorId: user10.id, // Department head creates the room
      tags: ['general', 'discussion', 'collaboration'],
    } as any,
  })

  // TICKET rooms with different departments
  // Tickets are created by admins (as per business logic), but assigned to regular users
  // Using 'as any' to work around TypeScript types not including ticketDepartment until migration is run
  const ticketRoom1 = await prisma.room.create({
    data: {
      name: 'ticket-login-issue',
      title: '[TICKET][IT Support] Cannot log in after latest update',
      description: 'User cannot log in after the latest update',
      type: RoomType.TICKET,
      isPrivate: true,
      status: TicketStatus.OPEN,
      ticketDepartment: TicketDepartment.IT_SUPPORT,
      creatorId: admin1.id, // Admin creates the ticket
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
      creatorId: admin1.id, // Admin creates the ticket
      tags: ['ticket', 'billing', 'subscription'],
    } as any,
  })

  const ticketRoom3 = await prisma.room.create({
    data: {
      name: 'ticket-feature-request',
      title: '[TICKET][Product] Dark mode toggle request',
      description: 'Request to add dark mode toggle in settings',
      type: RoomType.TICKET,
      isPrivate: true,
      status: TicketStatus.WAITING,
      ticketDepartment: TicketDepartment.PRODUCT,
      creatorId: admin2.id, // Admin creates the ticket
      tags: ['ticket', 'feature', 'ui'],
    } as any,
  })

  const ticketRoom4 = await prisma.room.create({
    data: {
      name: 'ticket-password-reset',
      title: '[TICKET][IT Support] Need help resetting password',
      description: 'Unable to reset password via email link',
      type: RoomType.TICKET,
      isPrivate: true,
      status: TicketStatus.OPEN,
      ticketDepartment: TicketDepartment.IT_SUPPORT,
      creatorId: admin2.id, // Admin creates the ticket
      tags: ['ticket', 'password', 'security'],
    } as any,
  })

  console.log(`✅ All ${roomNames.length} rooms created\n`)

  // ============================================
  // STEP 3: Create RoomMembers
  // ============================================
  console.log('👥 STEP 3: Adding members to rooms...')

  // PUBLIC_GLOBAL rooms (department === null): all INTERNAL users are members
  // External customers are NOT added to internal rooms
  const publicGlobalRooms = [generalRoom, randomRoom, gamingRoom]
  const internalUsers = [admin1, admin2, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, user11, user12]
  
  for (const room of publicGlobalRooms) {
    for (const user of internalUsers) {
      await prisma.roomMember.create({
        data: {
          userId: user.id,
          roomId: room.id,
          role: user.id === room.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
        },
      })
    }
  }
  console.log(`   ✅ Added all ${internalUsers.length} internal users to ${publicGlobalRooms.length} PUBLIC_GLOBAL rooms`)

  // Department-specific PUBLIC rooms: auto-join users to their department room
  // ENGINEERING room (#engineering): user1 (head), user2, user3 (members)
  const engineeringUsers = [user1, user2, user3] // Jacob (head), Alex, Sam
  for (const user of engineeringUsers) {
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: techRoom.id,
        role: user.id === techRoom.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  // Admins see all PUBLIC rooms, so add them
  for (const admin of [admin1, admin2]) {
    await prisma.roomMember.create({
      data: {
        userId: admin.id,
        roomId: techRoom.id,
        role: RoomRole.MEMBER,
      },
    })
  }
  console.log(`   ✅ Auto-joined ENGINEERING users to #engineering`)

  // BILLING room (#billing-internal): user4 (head), user5, user6 (members)
  const billingUsers = [user4, user5, user6] // May (head), Lisa, Tom
  for (const user of billingUsers) {
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: billingRoom.id,
        role: user.id === billingRoom.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  // Admins see all PUBLIC rooms
  for (const admin of [admin1, admin2]) {
    await prisma.roomMember.create({
      data: {
        userId: admin.id,
        roomId: billingRoom.id,
        role: RoomRole.MEMBER,
      },
    })
  }
  console.log(`   ✅ Auto-joined BILLING users to #billing-internal`)

  // PRODUCT room (#product): user7 (head), user8, user9 (members)
  const productUsers = [user7, user8, user9] // Ethan (head), Sarah, David
  for (const user of productUsers) {
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: productRoom.id,
        role: user.id === productRoom.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  // Admins see all PUBLIC rooms
  for (const admin of [admin1, admin2]) {
    await prisma.roomMember.create({
      data: {
        userId: admin.id,
        roomId: productRoom.id,
        role: RoomRole.MEMBER,
      },
    })
  }
  console.log(`   ✅ Auto-joined PRODUCT users to #product`)

  // GENERAL room (#general): user10 (head), user11, user12 (members)
  const generalDeptUsers = [user10, user11, user12] // Mike (head), Emma, Chris
  for (const user of generalDeptUsers) {
    await prisma.roomMember.create({
      data: {
        userId: user.id,
        roomId: generalRoom2.id,
        role: user.id === generalRoom2.creatorId ? RoomRole.OWNER : RoomRole.MEMBER,
      },
    })
  }
  // Admins see all PUBLIC rooms
  for (const admin of [admin1, admin2]) {
    await prisma.roomMember.create({
      data: {
        userId: admin.id,
        roomId: generalRoom2.id,
        role: RoomRole.MEMBER,
      },
    })
  }
  console.log(`   ✅ Auto-joined GENERAL users to #general`)

  // PRIVATE room: Only explicitly invited members (admins don't auto-see)
  // Private room: admin1 (owner/creator), admin2, user1 (invited members)
  await prisma.roomMember.create({
    data: { userId: admin1.id, roomId: privateRoom.id, role: RoomRole.OWNER },
  })
  await prisma.roomMember.create({
    data: { userId: admin2.id, roomId: privateRoom.id, role: RoomRole.MEMBER },
  })
  await prisma.roomMember.create({
    data: { userId: user1.id, roomId: privateRoom.id, role: RoomRole.MODERATOR },
  })
  console.log('   ✅ Private room members added (invite-only, admins not auto-added)')

  // Ticket rooms: Admin creates ticket (as MODERATOR), regular user is assigned (as OWNER)
  // This matches the business logic: admins create tickets, but assign them to staff
  const ticketRooms = [ticketRoom1, ticketRoom2, ticketRoom3, ticketRoom4]
  const ticketCreators = [admin1, admin1, admin2, admin2] // Admins create tickets
  const ticketAssignees = [user1, user4, user7, user2] // Regular users are assigned (OWNER)
  // ticketRoom1: IT_SUPPORT -> assign to user1 (Jacob, Engineering - can handle IT)
  // ticketRoom2: BILLING -> assign to user4 (May, Billing head)
  // ticketRoom3: PRODUCT -> assign to user7 (Ethan, Product head)
  // ticketRoom4: IT_SUPPORT -> assign to user2 (Alex, Engineering)
  
  for (let i = 0; i < ticketRooms.length; i++) {
    // Admin creator is MODERATOR (can manage the ticket)
    await prisma.roomMember.create({
      data: { userId: ticketCreators[i].id, roomId: ticketRooms[i].id, role: RoomRole.MODERATOR },
    })
    // Assigned user is OWNER (responsible for resolving)
    await prisma.roomMember.create({
      data: { userId: ticketAssignees[i].id, roomId: ticketRooms[i].id, role: RoomRole.OWNER },
    })
  }
  console.log(`   ✅ ${ticketRooms.length} ticket room members added (admins as creators, users as assignees)`)

  // External customer tickets removed - internal-only system
  console.log(`   ✅ External customer tickets removed (internal-only system)\n`)

  // Add DEMO_OBSERVER to rooms for portfolio demo visibility
  // Add to ALL PUBLIC rooms (both PUBLIC_GLOBAL and department-specific)
  // This ensures DEMO_OBSERVER can access all PUBLIC rooms for demo purposes
  const allPublicRooms = [...publicGlobalRooms, techRoom, billingRoom, productRoom, generalRoom2]
  for (const room of allPublicRooms) {
    // Use upsert to avoid errors if membership already exists
    await prisma.roomMember.upsert({
      where: {
        userId_roomId: {
          userId: demoObserver.id,
          roomId: room.id,
        },
      },
      update: {
        role: RoomRole.MEMBER, // Ensure role is set correctly
      },
      create: {
        userId: demoObserver.id,
        roomId: room.id,
        role: RoomRole.MEMBER,
      },
    })
  }
  console.log(`   ✅ Added DEMO_OBSERVER to ${allPublicRooms.length} PUBLIC rooms (all PUBLIC rooms)`)

  // Add to all ticket rooms (so they can see tickets and AI insights)
  for (const room of ticketRooms) {
    await prisma.roomMember.create({
      data: {
        userId: demoObserver.id,
        roomId: room.id,
        role: RoomRole.MEMBER,
      },
    })
  }
  console.log(`   ✅ Added DEMO_OBSERVER to ${ticketRooms.length} ticket rooms`)

  // Note: DEMO_OBSERVER is NOT added to PRIVATE rooms (like #leadership)

  // ============================================
  // STEP 4: Create Messages
  // ============================================
  console.log('💬 STEP 4: Generating messages...')
  console.log('   (Keeping total messages between 50-120 for optimal performance)\n')

  const seedSequence = async ({
    roomId,
    participants,
    messages,
    startAt,
    minGapMinutes = 8,
    maxGapMinutes = 180,
  }: {
    roomId: string
    participants: Array<{ id: string }>
    messages: string[]
    startAt: Date
    minGapMinutes?: number
    maxGapMinutes?: number
  }) => {
    let t = startAt
    for (let i = 0; i < messages.length; i++) {
      const u = participants[i % participants.length]
      await prisma.message.create({
      data: {
          roomId,
          userId: u.id,
          content: messages[i],
          createdAt: t,
        },
      })
      t = addMinutes(t, randInt(minGapMinutes, maxGapMinutes))
    }
  }

  const seedThread = async ({
    roomId,
    rootUserId,
    rootContent,
    rootCreatedAt,
    replies,
  }: {
    roomId: string
    rootUserId: string
    rootContent: string
    rootCreatedAt: Date
    replies: Array<{ userId: string; content: string; minutesAfter: number }>
  }) => {
    const root = await prisma.message.create({
      data: {
        roomId,
        userId: rootUserId,
        content: rootContent,
        createdAt: rootCreatedAt,
      },
    })
    for (const r of replies) {
    await prisma.message.create({
      data: {
          roomId,
          userId: r.userId,
          content: r.content,
          parentMessageId: root.id,
          createdAt: addMinutes(rootCreatedAt, r.minutesAfter),
      },
    })
  }
  }

  // Spread activity across the last week so rooms feel natural
  const startAnnouncements = randomPastWeekDate()
  const startEngineering = randomPastWeekDate()
  const startLounge = randomPastWeekDate()
  const startCustomerVoice = randomPastWeekDate()
  const startBilling = randomPastWeekDate()
  const startProduct = randomPastWeekDate()
  const startGeneral = randomPastWeekDate()
  const startLeadership = randomPastWeekDate()

  // #announcements (PUBLIC_GLOBAL): mostly admins, occasional team replies
  await seedSequence({
    roomId: generalRoom.id,
    participants: [admin1, admin2, user7, user4, user1],
    messages: [
      'Welcome! Use #announcements for official updates; department rooms for day-to-day.',
      'Deploy window this weekend: Saturday 02:00–03:00 UTC. Expect brief read-only mode.',
      'FYI: ticket SLA target for first response is now 2h during business hours.',
      'We’re updating escalation procedures — please skim the doc when you can.',
      'Nice work last week: response-time metrics improved noticeably.',
      'For portfolio/demo: DEMO_OBSERVER is read-only but can browse PUBLIC rooms.',
      randomMessage(announcementMessages),
      randomMessage(announcementMessages),
      randomMessage(announcementMessages),
      'Reminder: avoid posting customer PII in public rooms — use ticket IDs.',
      'All hands Friday 2pm. Agenda: Q1 roadmap + reliability updates.',
    ],
    startAt: startAnnouncements,
    minGapMinutes: 30,
    maxGapMinutes: 8 * 60,
  })
  console.log(`   ✅ Seeded conversation for Company Announcements`)

  // #engineering (ENGINEERING): incident-y, more rapid back-and-forth
  await seedSequence({
    roomId: techRoom.id,
    participants: [user1, user2, user3, admin1],
    messages: [
      'Seeing a spike in auth errors after the last deploy — anyone else?',
      'Confirmed: errors mostly on refresh-token rotation. Digging.',
      'Likely related to cookie SameSite changes. I’ll patch and run staging.',
      'While you’re at it, can we add a dashboard panel for 401/403 by route?',
      'Patch is ready — deploying a hotfix in 10.',
      'Hotfix deployed. Error rate trending down.',
      randomMessage(engineeringMessages),
      randomMessage(engineeringMessages),
      'Postmortem note: add a canary step for auth flows next time.',
      'I’ll update the runbook for “login failures after deploy”.',
      randomMessage(engineeringMessages),
      randomMessage(engineeringMessages),
    ],
    startAt: startEngineering,
    minGapMinutes: 6,
    maxGapMinutes: 90,
  })
  console.log(`   ✅ Seeded conversation for Engineering & Incidents`)

  // #team-lounge (PUBLIC_GLOBAL): casual
  await seedSequence({
    roomId: randomRoom.id,
    participants: [user10, user11, user12, user8, admin2, user2],
    messages: [
      'Coffee check: who wants a refill?',
      'Shoutout to whoever handled that gnarly billing thread — saved my morning.',
      'Weekend plans? I’m thinking hiking if weather holds.',
      'Question: favorite keyboard shortcut you can’t live without?',
      'I’m voting for “search in repo” being the real MVP.',
      'We should do a 15-min “demo tips” session for new folks.',
      randomMessage(loungeMessages),
      randomMessage(loungeMessages),
      randomMessage(loungeMessages),
      'Also… what’s the best desk snack? Asking for science.',
      randomMessage(loungeMessages),
    ],
    startAt: startLounge,
    minGapMinutes: 20,
    maxGapMinutes: 6 * 60,
  })
  console.log(`   ✅ Seeded conversation for Team Lounge`)

  // #customer-voice (PUBLIC_GLOBAL): feedback snippets + a short thread
  await seedSequence({
    roomId: gamingRoom.id,
    participants: [user8, user7, admin2, user4, user1],
    messages: [
      'Dropping a few themes from support this week:',
      '1) invoices hard to find\n2) want Slack notifications\n3) dark mode requests keep coming',
      randomMessage(customerVoiceMessages),
      randomMessage(customerVoiceMessages),
      'If you hear a strong quote, paste it here (no PII).',
      randomMessage(customerVoiceMessages),
    ],
    startAt: startCustomerVoice,
    minGapMinutes: 45,
    maxGapMinutes: 10 * 60,
  })
  await seedThread({
    roomId: gamingRoom.id,
    rootUserId: user7.id,
    rootContent: 'Customer asked: “Can I export ticket history for audits?” — feels like a common enterprise need.',
    rootCreatedAt: addMinutes(startCustomerVoice, 12),
    replies: [
      { userId: admin2.id, content: 'Agree. Let’s capture this as a product request + note which formats matter (CSV/PDF).', minutesAfter: 35 },
      { userId: user4.id, content: 'Billing angle: invoices + ticket exports often requested together. Might bundle as “Reports & Exports”.', minutesAfter: 75 },
      { userId: user1.id, content: 'If we do this, ensure export respects room access rules (and redacts PII).', minutesAfter: 120 },
    ],
  })
  console.log(`   ✅ Seeded conversation for Customer Voice`)

  // #billing-internal (BILLING): policy + operational notes
  await seedSequence({
    roomId: billingRoom.id,
    participants: [user4, user5, user6, admin1],
    messages: [
      'Morning Billing team — any escalations we should preempt today?',
      randomMessage(billingMessages),
      randomMessage(billingMessages),
      'I’ll update the macro for proration explanations after lunch.',
      randomMessage(billingMessages),
      'If you see “double charge” reports, ask for last 4 + timestamp and check pending auth holds.',
      randomMessage(billingMessages),
      'Closing the loop on finance request: tagging guidelines posted in the doc.',
    ],
    startAt: startBilling,
    minGapMinutes: 25,
    maxGapMinutes: 5 * 60,
  })
  console.log(`   ✅ Seeded conversation for Billing & Accounts (Internal)`)

  // #product (PRODUCT): roadmap-y
  await seedSequence({
    roomId: productRoom.id,
    participants: [user7, user8, user9, admin2],
    messages: [
      'Sprint planning prep: top 3 asks from support?',
      randomMessage(productMessages),
      'My guess: 1) dark mode, 2) saved searches, 3) Slack notifications.',
      randomMessage(productMessages),
      randomMessage(productMessages),
      'Can we align on a “demo narrative” for the portfolio version? (read-only but rich data).',
      randomMessage(productMessages),
      'I’ll summarize decisions after the meeting.',
    ],
    startAt: startProduct,
    minGapMinutes: 40,
    maxGapMinutes: 8 * 60,
  })
  console.log(`   ✅ Seeded conversation for Product & Features`)

  // #general (GENERAL dept): cross-team coordination
  await seedSequence({
    roomId: generalRoom2.id,
    participants: [user10, user11, user12, admin1, user2],
    messages: [
      randomMessage(generalDiscussionMessages),
      randomMessage(generalDiscussionMessages),
      'Heads up: we’re polishing the demo seed so rooms look naturally active.',
      randomMessage(generalDiscussionMessages),
      randomMessage(generalDiscussionMessages),
      'If you spot any confusing chat UX, drop notes here.',
      randomMessage(generalDiscussionMessages),
      'Thanks all — keep it moving.',
    ],
    startAt: startGeneral,
    minGapMinutes: 35,
    maxGapMinutes: 9 * 60,
  })
  console.log(`   ✅ Seeded conversation for General Discussion`)

  // #leadership (PRIVATE): fewer, higher-signal messages
  await seedSequence({
        roomId: privateRoom.id,
    participants: [admin1, admin2, user1],
    messages: [
      'Weekly review: anything urgent we should unblock cross-team?',
      'Ticket volume is up but response time is stable. Keep an eye on auth-related issues.',
      'Decision: prioritize reliability and demo polish this week. No big refactors.',
      randomMessage(leadershipMessages),
      randomMessage(leadershipMessages),
      'Action items: update escalation doc + confirm on-call rotations.',
    ],
    startAt: startLeadership,
    minGapMinutes: 90,
    maxGapMinutes: 12 * 60,
  })
  console.log(`   ✅ Seeded conversation for Leadership Sync`)

  // DM room removed per requirements

  // Ticket rooms: Realistic conversations
  // Admin creates ticket with description, assigned user responds and resolves
  for (let i = 0; i < ticketRooms.length; i++) {
    const conversation = ticketConversations[i] || ticketConversations[0]
    const ticketCreatedAt = randomPastWeekDate()
    
    // 1. Admin creates ticket with initial description
    const mainMessage = await prisma.message.create({
      data: {
        roomId: ticketRooms[i].id,
        userId: ticketCreators[i].id, // Admin creator
        content: conversation.initial,
        createdAt: ticketCreatedAt,
      },
    })
    
    // 2. Assigned user responds (1-3 hours later)
    const firstResponseTime = new Date(ticketCreatedAt.getTime() + (1 + Math.random() * 2) * 60 * 60 * 1000)
    let lastMessageId = mainMessage.id
    let lastMessageTime = firstResponseTime
    
    for (let j = 0; j < conversation.responses.length; j++) {
      const response = conversation.responses[j]
      // Assigned user responds (they're the OWNER)
      const responseMessage = await prisma.message.create({
        data: {
          roomId: ticketRooms[i].id,
          userId: ticketAssignees[i].id, // Assigned user responds
          content: response,
          parentMessageId: lastMessageId,
          createdAt: lastMessageTime,
        },
      })
      
      lastMessageId = responseMessage.id
      // Next message 30 minutes to 2 hours later
      lastMessageTime = new Date(lastMessageTime.getTime() + (30 + Math.random() * 90) * 60 * 1000)
    }
  }
  console.log(`   ✅ Generated realistic conversations for ${ticketRooms.length} tickets`)

  // Add messages to customer tickets (so they have content to display)
  // External customer ticket messages removed - internal-only system
  // Customer ticket 1: customer1's account issue (REMOVED)
  /* const customer1MainMessage = await prisma.message.create({
    data: {
      roomId: customerTicket1.id,
      userId: customer1.id,
      content: 'I cannot log into my account after password reset. I tried multiple times but keep getting an error.',
      createdAt: randomPastWeekDate(),
    },
  })
  // Admin reply
  await prisma.message.create({
    data: {
      roomId: customerTicket1.id,
      userId: admin1.id,
      content: 'Thanks for reporting this. I\'ve reset your account access. Please try logging in again with your email and the temporary password I\'ve sent.',
      parentMessageId: customer1MainMessage.id,
      createdAt: randomPastWeekDate(),
    },
  })
  // Customer follow-up
  await prisma.message.create({
    data: {
      roomId: customerTicket1.id,
      userId: customer1.id,
      content: 'Thank you! I was able to log in successfully now.',
      parentMessageId: customer1MainMessage.id,
      createdAt: randomPastWeekDate(),
    },
  })
  console.log(`   ✅ Generated 3 messages for customer ticket 1 (account issue)`)

  // Customer ticket 2: customer2's payment issue (REMOVED)
  /* const customer2MainMessage = await prisma.message.create({
    data: {
      roomId: customerTicket2.id,
      userId: customer2.id,
      content: 'My credit card is being declined when trying to update payment method. The card works fine elsewhere.',
      createdAt: randomPastWeekDate(),
    },
  })
  // Admin reply
  await prisma.message.create({
    data: {
      roomId: customerTicket2.id,
      userId: admin2.id,
      content: 'I see the issue. There was a temporary problem with our payment processor. Please try again now - it should work.',
      parentMessageId: customer2MainMessage.id,
      createdAt: randomPastWeekDate(),
    },
  })
  console.log(`   ✅ Generated 2 messages for customer ticket 2 (payment issue)`) */

  // NOTE: use DB count below for accuracy (avoid manual math drift).

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
  
  // Verify each internal user has memberships
  for (const user of internalUsers) {
    const userMemberships = await prisma.roomMember.count({
      where: { userId: user.id },
    })
    if (userMemberships === 0) {
      throw new Error(`❌ User ${user.email} has no room memberships`)
    }
    console.log(`   ✅ ${user.email}: ${userMemberships} room memberships`)
  }

  // External customer verification removed - internal-only system
  // Verification skipped for external customers (removed from seed data)
  const externalCustomers: any[] = []
  for (const customer of externalCustomers) {
    const ticketMemberships = await prisma.roomMember.count({
      where: {
        userId: customer.id,
        room: { type: RoomType.TICKET },
      },
    })
    const internalMemberships = await prisma.roomMember.count({
      where: {
        userId: customer.id,
        room: { type: { in: [RoomType.PUBLIC, RoomType.PRIVATE] } },
      },
    })
    if (ticketMemberships === 0) {
      throw new Error(`❌ External customer ${customer.email} has no ticket memberships`)
    }
    if (internalMemberships > 0) {
      throw new Error(`❌ External customer ${customer.email} has internal room memberships (should not)`)
    }
    console.log(`   ✅ ${customer.email}: ${ticketMemberships} ticket memberships, 0 internal memberships`)
  }
  
  // Verify each room has members
  const allRooms = [generalRoom, techRoom, randomRoom, privateRoom, gamingRoom, billingRoom, productRoom, generalRoom2, ...ticketRooms]
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
  console.log('   ENGINEERING: jacob@solace.com (head), alex@solace.com, sam@solace.com')
  console.log('   BILLING: may@solace.com (head), lisa@solace.com, tom@solace.com')
  console.log('   PRODUCT: ethan@solace.com (head), sarah@solace.com, david@solace.com')
  console.log('   GENERAL: mike@solace.com (head), emma@solace.com, chris@solace.com')
  console.log('   External Customers: Removed (internal-only system)')
  console.log('   Password for all: demo123')
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
