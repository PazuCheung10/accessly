import { PrismaClient, Role, RoomRole, RoomType, TicketStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Helper to generate random date within last 14 days
function randomDate(daysAgo: number = 0): Date {
  const now = Date.now()
  const daysInMs = daysAgo * 24 * 60 * 60 * 1000
  const randomMs = Math.random() * (14 * 24 * 60 * 60 * 1000) // Random time within 14 days
  return new Date(now - daysInMs - randomMs)
}

// Helper to add minutes to a date
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

// Helper to add hours to a date
function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600000)
}

async function main() {
  console.log('🎭 Starting SolaceDesk seed...')
  console.log('   Project: SolaceDesk')
  console.log('   Tagline: Where teams and customers meet clarity.\n')

  // Clear existing data
  console.log('🧹 Clearing existing data...')
  await prisma.message.deleteMany({})
  await prisma.roomMember.deleteMany({})
  await prisma.room.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('✅ Cleared existing data\n')

  // Hash password for all users
  const hashedPassword = await bcrypt.hash('demo123', 10)

  // 1. Create Users
  console.log('👥 Creating users...')
  
  const users = [
    // Admins
    {
      email: 'admin@solace.com',
      name: 'Alex Admin',
      role: Role.ADMIN,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex-admin',
    },
    {
      email: 'clara@solace.com',
      name: 'Clara Martinez',
      role: Role.ADMIN,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=clara-martinez',
    },
    // Agents
    {
      email: 'jacob@solace.com',
      name: 'Jacob Chen',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jacob-chen',
    },
    {
      email: 'may@solace.com',
      name: 'May Thompson',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=may-thompson',
    },
    {
      email: 'ethan@solace.com',
      name: 'Ethan Rodriguez',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ethan-rodriguez',
    },
    // Clients
    {
      email: 'client@acme.com',
      name: 'Sarah Johnson',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah-johnson',
    },
    {
      email: 'client@starflow.com',
      name: 'Michael Park',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=michael-park',
    },
    {
      email: 'client@nova.com',
      name: 'Emily Davis',
      role: Role.USER,
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emily-davis',
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
    console.log(`✅ Created ${userData.role} user: ${userData.email} (${userData.name})`)
  }

  const [admin1, admin2, agent1, agent2, agent3, client1, client2, client3] = createdUsers
  console.log('✅ All users created')
  console.log('   Password for all users: demo123\n')

  // 2. Create Team Rooms (PUBLIC)
  console.log('🏠 Creating team rooms (PUBLIC)...')
  
  const teamRooms = [
    {
      name: '#engineering',
      title: 'Engineering',
      description: 'Engineering discussions, code reviews, and technical updates',
      tags: ['engineering', 'development', 'tech'],
      creatorId: admin1.id,
    },
    {
      name: '#design',
      title: 'Design',
      description: 'Design reviews, UI/UX discussions, and creative collaboration',
      tags: ['design', 'ui', 'ux', 'creative'],
      creatorId: admin1.id,
    },
    {
      name: '#product',
      title: 'Product',
      description: 'Product planning, feature discussions, and roadmap',
      tags: ['product', 'features', 'roadmap'],
      creatorId: admin2.id,
    },
    {
      name: '#announcements',
      title: 'Announcements',
      description: 'Company-wide announcements and important updates',
      tags: ['announcements', 'updates', 'company'],
      creatorId: admin1.id,
    },
    {
      name: '#random',
      title: 'Random',
      description: 'General chat, water cooler conversations, and fun stuff',
      tags: ['random', 'chat', 'fun'],
      creatorId: admin2.id,
    },
  ]

  const createdTeamRooms = []
  for (const roomData of teamRooms) {
    const room = await prisma.room.create({
      data: {
        ...roomData,
        isPrivate: false,
        type: RoomType.PUBLIC,
        createdAt: randomDate(10),
      },
    })
    createdTeamRooms.push(room)
    console.log(`✅ Created team room: ${room.name}`)
  }
  console.log('✅ All team rooms created\n')

  // 3. Create Private Rooms
  console.log('🔒 Creating private rooms...')
  
  const privateRooms = [
    {
      name: '#support-team',
      title: 'Support Team',
      description: 'Internal support team discussions and coordination',
      tags: ['support', 'internal', 'team'],
      creatorId: admin1.id,
    },
    {
      name: 'client-acme',
      title: 'Client — Acme Corp',
      description: 'Private channel for Acme Corp communications',
      tags: ['client', 'acme'],
      creatorId: admin1.id,
    },
    {
      name: 'client-starflow',
      title: 'Client — Starflow',
      description: 'Private channel for Starflow communications',
      tags: ['client', 'starflow'],
      creatorId: admin1.id,
    },
    {
      name: 'client-nova',
      title: 'Client — Nova Studio',
      description: 'Private channel for Nova Studio communications',
      tags: ['client', 'nova'],
      creatorId: admin1.id,
    },
  ]

  const createdPrivateRooms = []
  for (const roomData of privateRooms) {
    const room = await prisma.room.create({
      data: {
        ...roomData,
        isPrivate: true,
        type: RoomType.PRIVATE,
        createdAt: randomDate(12),
      },
    })
    createdPrivateRooms.push(room)
    console.log(`✅ Created private room: ${room.name}`)
  }
  console.log('✅ All private rooms created\n')

  // 4. Create Ticket Rooms
  console.log('🎫 Creating ticket rooms...')
  
  const ticketData = [
    {
      title: '[TICKET] Cannot reset password',
      description: 'User unable to reset password via email link',
      status: TicketStatus.RESOLVED,
      mainMessage: 'Hi, I\'ve been trying to reset my password but the email link doesn\'t work. I click it and it says "link expired" even though I just received it. Can someone help?',
      replies: [
        { author: agent1, content: 'Thanks for reaching out! I can help you with that. Can you try requesting a new password reset link? Sometimes the links expire quickly for security reasons.', minutesLater: 15 },
        { author: client1, content: 'I tried that already, same issue. The link expires immediately.', minutesLater: 30 },
        { author: agent1, content: 'I see. Let me check your account settings. Can you tell me what email you\'re using?', minutesLater: 45 },
        { author: client1, content: 'sarah.johnson@acme.com', minutesLater: 60 },
        { author: agent1, content: 'I found the issue! Your email provider might be blocking our reset emails. I\'ve manually reset your password and sent it to your email. Please check your spam folder.', minutesLater: 90 },
        { author: client1, content: 'Found it! Thank you so much. I\'ll update my email filters.', minutesLater: 120 },
        { author: agent1, content: 'Great! The issue is resolved. If you have any other questions, feel free to reach out.', minutesLater: 125 },
      ],
    },
    {
      title: '[TICKET] Billing issue: charged twice',
      description: 'Customer was charged twice for the same subscription',
      status: TicketStatus.RESOLVED,
      mainMessage: 'I noticed I was charged twice this month for my subscription. I only have one account, so this seems like a billing error. Can you please refund one of the charges?',
      replies: [
        { author: agent2, content: 'I apologize for the inconvenience! I\'m looking into this right away.', minutesLater: 10 },
        { author: agent2, content: 'I can see the duplicate charge in our system. This was a processing error on our end. I\'ve issued a full refund for the second charge, which should appear in your account within 3-5 business days.', minutesLater: 25 },
        { author: client2, content: 'Thank you! How long will the refund take?', minutesLater: 40 },
        { author: agent2, content: 'Typically 3-5 business days, but it can sometimes take up to 10 days depending on your bank. You\'ll receive an email confirmation once it\'s processed.', minutesLater: 50 },
        { author: client2, content: 'Perfect, thanks for the quick resolution!', minutesLater: 60 },
      ],
    },
    {
      title: '[TICKET] Feature request: dark mode',
      description: 'Request to add dark mode theme option',
      status: TicketStatus.OPEN,
      mainMessage: 'I love the platform, but I work late hours and the bright white interface is hard on my eyes. Would it be possible to add a dark mode option? I know many users would appreciate this feature.',
      replies: [
        { author: admin1, content: 'Thanks for the feedback! Dark mode is actually on our roadmap for Q2. I\'ll make sure to prioritize this feature.', minutesLater: 20 },
        { author: client3, content: 'That\'s great to hear! Any timeline on when we might see it?', minutesLater: 35 },
        { author: admin1, content: 'We\'re aiming for a beta release in about 6-8 weeks. I\'ll keep you updated as we make progress!', minutesLater: 50 },
        { author: client3, content: 'Awesome, looking forward to it!', minutesLater: 55 },
      ],
    },
    {
      title: '[TICKET] Bug: app freezes on upload',
      description: 'Application freezes when uploading large files',
      status: TicketStatus.WAITING,
      mainMessage: 'Every time I try to upload a file larger than 50MB, the app completely freezes. I have to refresh the page and lose my work. This is really frustrating. Is there a file size limit I should know about?',
      replies: [
        { author: agent3, content: 'I\'m sorry you\'re experiencing this issue. There is a 100MB file size limit, so that shouldn\'t be the problem. Can you tell me what browser and OS you\'re using?', minutesLater: 15 },
        { author: client1, content: 'I\'m using Chrome on Windows 11. The file is about 75MB.', minutesLater: 30 },
        { author: agent3, content: 'Thanks for the details. I\'ve escalated this to our engineering team. This might be a memory issue with large file uploads. In the meantime, you could try splitting the file or using a different browser.', minutesLater: 45 },
        { author: client1, content: 'I\'ll try Firefox and see if that helps. Thanks for looking into it.', minutesLater: 60 },
        { author: agent3, content: 'I\'ll follow up once engineering has a fix. We\'ll keep this ticket open and update you.', minutesLater: 65 },
      ],
    },
    {
      title: '[TICKET] API rate limit too restrictive',
      description: 'Customer requesting higher API rate limits',
      status: TicketStatus.OPEN,
      mainMessage: 'We\'re building an integration with your API, but we keep hitting the rate limit. We\'re on the Pro plan. Is there a way to increase our rate limit, or do we need to upgrade?',
      replies: [
        { author: agent1, content: 'Hi! I can help with that. The Pro plan includes 10,000 requests per hour. What\'s your current usage pattern?', minutesLater: 20 },
        { author: client2, content: 'We\'re making about 15,000 requests per hour during peak times. We sync data every 5 minutes.', minutesLater: 40 },
        { author: agent1, content: 'I see. For that volume, you\'d need the Enterprise plan which includes 50,000 requests/hour. However, I can also help optimize your API calls - you might be able to reduce the frequency with batch endpoints.', minutesLater: 55 },
        { author: client2, content: 'Can you tell me more about the batch endpoints? That might work better for us.', minutesLater: 70 },
        { author: agent1, content: 'Absolutely! Batch endpoints allow you to process up to 100 items in a single request. This could reduce your API calls significantly. I\'ll send you the documentation.', minutesLater: 85 },
      ],
    },
    {
      title: '[TICKET] Export feature not working',
      description: 'Export button returns error when clicking',
      status: TicketStatus.RESOLVED,
      mainMessage: 'I\'m trying to export my data but when I click the export button, I get an error message that says "Export failed". I\'ve tried both JSON and PDF formats. What\'s going on?',
      replies: [
        { author: agent2, content: 'I apologize for the trouble. Can you tell me what browser you\'re using and if you see any specific error code?', minutesLater: 12 },
        { author: client3, content: 'I\'m on Safari. The error just says "Export failed" with no code.', minutesLater: 25 },
        { author: agent2, content: 'I found the issue - there\'s a known bug with Safari and our export feature. We\'ve just deployed a fix. Can you try again now?', minutesLater: 40 },
        { author: client3, content: 'It works now! Thank you!', minutesLater: 50 },
        { author: agent2, content: 'Great! Sorry for the inconvenience. The fix is now live for all users.', minutesLater: 52 },
      ],
    },
    {
      title: '[TICKET] Need help with SSO setup',
      description: 'Customer needs assistance configuring SSO integration',
      status: TicketStatus.OPEN,
      mainMessage: 'We want to set up SSO for our team using Okta. I\'ve looked at the documentation but I\'m not sure about the SAML configuration. Can someone walk me through it?',
      replies: [
        { author: admin2, content: 'I\'d be happy to help you set up SSO with Okta! Let me send you our step-by-step guide for Okta specifically.', minutesLater: 15 },
        { author: client1, content: 'That would be great, thank you!', minutesLater: 20 },
        { author: admin2, content: 'I\'ve sent the guide to your email. The key steps are: 1) Create a SAML app in Okta, 2) Configure the ACS URL and Entity ID, 3) Download the metadata file and upload it to our platform. Let me know if you get stuck on any step!', minutesLater: 30 },
        { author: client1, content: 'I\'m on step 2. What should I use for the Entity ID?', minutesLater: 45 },
        { author: admin2, content: 'Use: https://solacedesk.com/saml. For the ACS URL, use: https://solacedesk.com/api/auth/saml/callback', minutesLater: 50 },
        { author: client1, content: 'Perfect, got it configured. Testing now...', minutesLater: 65 },
      ],
    },
    {
      title: '[TICKET] Mobile app crashes on iOS',
      description: 'App crashes immediately after login on iOS devices',
      status: TicketStatus.WAITING,
      mainMessage: 'The mobile app crashes as soon as I log in on my iPhone. It worked fine last week. I\'ve tried reinstalling but same issue. iOS 17.2, iPhone 14 Pro.',
      replies: [
        { author: agent3, content: 'I\'m sorry for the trouble. We released an update yesterday that might have introduced this bug. Can you tell me what version of the app you\'re using?', minutesLater: 10 },
        { author: client2, content: 'Version 2.4.1', minutesLater: 20 },
        { author: agent3, content: 'That\'s the latest version. I\'ve reported this to our mobile team. In the meantime, you can use the web version which should work fine. We\'ll push a hotfix as soon as possible.', minutesLater: 30 },
        { author: client2, content: 'How long until the fix?', minutesLater: 40 },
        { author: agent3, content: 'We\'re aiming for a hotfix release within 24-48 hours. I\'ll notify you as soon as it\'s available.', minutesLater: 45 },
      ],
    },
  ]

  const createdTickets = []
  for (const ticket of ticketData) {
    const ticketCreatedAt = randomDate(7)
    const ticketRoom = await prisma.room.create({
      data: {
        name: ticket.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: ticket.title,
        description: ticket.description,
        type: RoomType.TICKET,
        status: ticket.status,
        tags: ['ticket', 'support'],
        creatorId: admin1.id,
        createdAt: ticketCreatedAt,
      },
    })
    createdTickets.push({ room: ticketRoom, data: ticket })
    console.log(`✅ Created ticket: ${ticket.title} (${ticket.status})`)
  }
  console.log('✅ All ticket rooms created\n')

  // 5. Add Room Members
  console.log('👥 Adding room members...')
  
  // Team rooms: all staff members
  for (const room of createdTeamRooms) {
    await prisma.roomMember.createMany({
      data: [
        { userId: admin1.id, roomId: room.id, role: RoomRole.OWNER },
        { userId: admin2.id, roomId: room.id, role: RoomRole.MEMBER },
        { userId: agent1.id, roomId: room.id, role: RoomRole.MEMBER },
        { userId: agent2.id, roomId: room.id, role: RoomRole.MEMBER },
        { userId: agent3.id, roomId: room.id, role: RoomRole.MEMBER },
      ],
      skipDuplicates: true,
    })
  }

  // Support team room: admins + agents only
  const supportTeamRoom = createdPrivateRooms[0]
  await prisma.roomMember.createMany({
    data: [
      { userId: admin1.id, roomId: supportTeamRoom.id, role: RoomRole.OWNER },
      { userId: admin2.id, roomId: supportTeamRoom.id, role: RoomRole.MEMBER },
      { userId: agent1.id, roomId: supportTeamRoom.id, role: RoomRole.MEMBER },
      { userId: agent2.id, roomId: supportTeamRoom.id, role: RoomRole.MEMBER },
      { userId: agent3.id, roomId: supportTeamRoom.id, role: RoomRole.MEMBER },
    ],
    skipDuplicates: true,
  })

  // Client rooms: respective client + all staff
  const acmeRoom = createdPrivateRooms[1]
  await prisma.roomMember.createMany({
    data: [
      { userId: admin1.id, roomId: acmeRoom.id, role: RoomRole.OWNER },
      { userId: client1.id, roomId: acmeRoom.id, role: RoomRole.MEMBER },
      { userId: agent1.id, roomId: acmeRoom.id, role: RoomRole.MEMBER },
    ],
    skipDuplicates: true,
  })

  const starflowRoom = createdPrivateRooms[2]
  await prisma.roomMember.createMany({
    data: [
      { userId: admin1.id, roomId: starflowRoom.id, role: RoomRole.OWNER },
      { userId: client2.id, roomId: starflowRoom.id, role: RoomRole.MEMBER },
      { userId: agent2.id, roomId: starflowRoom.id, role: RoomRole.MEMBER },
    ],
    skipDuplicates: true,
  })

  const novaRoom = createdPrivateRooms[3]
  await prisma.roomMember.createMany({
    data: [
      { userId: admin1.id, roomId: novaRoom.id, role: RoomRole.OWNER },
      { userId: client3.id, roomId: novaRoom.id, role: RoomRole.MEMBER },
      { userId: agent3.id, roomId: novaRoom.id, role: RoomRole.MEMBER },
    ],
    skipDuplicates: true,
  })

  // Tickets: client who created it + assigned agent/admin
  for (const { room, data } of createdTickets) {
    // Determine which client based on ticket content
    let ticketClient = client1
    let ticketStaff = agent1
    
    if (data.mainMessage.includes('acme') || data.replies.some(r => r.author === client1)) {
      ticketClient = client1
      ticketStaff = agent1
    } else if (data.mainMessage.includes('starflow') || data.replies.some(r => r.author === client2)) {
      ticketClient = client2
      ticketStaff = agent2
    } else if (data.mainMessage.includes('nova') || data.replies.some(r => r.author === client3)) {
      ticketClient = client3
      ticketStaff = agent3
    }

    // Assign owner based on who responds first
    const firstResponder = data.replies[0]?.author
    const owner = firstResponder?.role === Role.ADMIN ? firstResponder : admin1

    await prisma.roomMember.createMany({
      data: [
        { userId: owner.id, roomId: room.id, role: RoomRole.OWNER },
        { userId: ticketClient.id, roomId: room.id, role: RoomRole.MEMBER },
        ...data.replies
          .map(r => r.author)
          .filter((author, index, self) => self.findIndex(a => a.id === author.id) === index)
          .map(author => ({ userId: author.id, roomId: room.id, role: RoomRole.MEMBER })),
      ],
      skipDuplicates: true,
    })
  }

  console.log('✅ All room members added\n')

  // 6. Create Messages
  console.log('💬 Creating messages...')

  // Team room messages
  const engineeringMessages = [
    { content: 'Hey team! Just pushed the new authentication flow. Can someone review the PR?', author: agent1 },
    { content: 'I\'ll take a look!', author: admin1, parent: 0 },
    { content: 'Looks good overall, but I noticed the token refresh logic could be improved. Left some comments.', author: admin1, parent: 0 },
    { content: 'Thanks for the review! I\'ll address those comments.', author: agent1, parent: 2 },
    { content: 'Anyone working on the search feature? I have some ideas about the indexing strategy.', author: agent2 },
    { content: 'I\'m working on it! What are your thoughts?', author: agent3, parent: 4 },
    { content: 'I think we should use Elasticsearch for better performance. The current PostgreSQL full-text search is getting slow with large datasets.', author: agent2, parent: 5 },
  ]

  const designMessages = [
    { content: 'New design system components are ready for review! Check out the Figma file.', author: agent2 },
    { content: 'These look amazing! Love the new color palette.', author: admin2, parent: 0 },
    { content: 'Can we add more spacing variants? I think we need more granular control.', author: agent1, parent: 0 },
    { content: 'Good point! I\'ll add xs, sm, md, lg, xl variants.', author: agent2, parent: 2 },
    { content: 'When will these be available in Storybook?', author: admin1, parent: 0 },
    { content: 'Should be ready by end of week!', author: agent2, parent: 4 },
  ]

  const productMessages = [
    { content: 'Q2 roadmap is ready for review. Focus areas: performance, new integrations, and mobile improvements.', author: admin2 },
    { content: 'Excited about the mobile improvements! What\'s the timeline?', author: agent3, parent: 0 },
    { content: 'We\'re aiming for beta in 6 weeks, full release in 10 weeks.', author: admin2, parent: 1 },
    { content: 'Should we prioritize the API rate limit increases? Got a lot of customer requests for that.', author: agent1, parent: 0 },
    { content: 'Yes, that\'s high priority. Let\'s move it to Q2 sprint 1.', author: admin2, parent: 3 },
  ]

  const announcementMessages = [
    { content: '🎉 Welcome to SolaceDesk! We\'re excited to have you here.', author: admin1 },
    { content: 'Team meeting moved to 3 PM today. See you there!', author: admin2 },
    { content: 'New feature release: Export functionality is now live! Check it out.', author: admin1 },
  ]

  const randomMessages = [
    { content: 'Anyone up for lunch?', author: agent1 },
    { content: 'I\'m in!', author: agent2, parent: 0 },
    { content: 'Count me in too!', author: agent3, parent: 0 },
    { content: 'Great movie last night! Anyone else watch it?', author: admin1 },
    { content: 'Yes! The ending was incredible.', author: agent2, parent: 3 },
  ]

  const teamRoomMessages = [
    { room: createdTeamRooms[0], messages: engineeringMessages },
    { room: createdTeamRooms[1], messages: designMessages },
    { room: createdTeamRooms[2], messages: productMessages },
    { room: createdTeamRooms[3], messages: announcementMessages },
    { room: createdTeamRooms[4], messages: randomMessages },
  ]

  for (const { room, messages } of teamRoomMessages) {
    const roomCreatedAt = room.createdAt
    let messageTime = addHours(roomCreatedAt, 1)
    const createdMessages: { id: string; index: number }[] = []
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      let parentMessageId = null
      
      if (msg.parent !== undefined) {
        const parentMsg = createdMessages.find(m => m.index === msg.parent)
        parentMessageId = parentMsg?.id || null
      }

      const created = await prisma.message.create({
        data: {
          roomId: room.id,
          userId: msg.author.id,
          content: msg.content,
          parentMessageId,
          createdAt: messageTime,
        },
      })
      
      createdMessages.push({ id: created.id, index: i })
      messageTime = addMinutes(messageTime, Math.random() * 30 + 5)
    }
  }

  // Client room messages
  const acmeClientMessages = [
    { content: 'Hi team! We need to discuss the upcoming feature launch. Can we schedule a call?', author: client1 },
    { content: 'Absolutely! I\'m available tomorrow afternoon. Does 2 PM work for you?', author: agent1, parent: 0 },
    { content: 'Perfect! I\'ll send a calendar invite.', author: client1, parent: 1 },
    { content: 'Also, we noticed the dashboard is loading slowly. Is there anything we can do to optimize it?', author: client1 },
    { content: 'I\'ll investigate that. Might be a caching issue. I\'ll get back to you by end of day.', author: agent1, parent: 3 },
  ]

  const starflowClientMessages = [
    { content: 'Quick question: Can we customize the branding in the customer portal?', author: client2 },
    { content: 'Yes! That\'s available in the Enterprise plan. I can walk you through the setup.', author: agent2, parent: 0 },
    { content: 'Great! When can we do that?', author: client2, parent: 1 },
    { content: 'How about this afternoon? I\'ll send you the configuration guide.', author: agent2, parent: 2 },
  ]

  const novaClientMessages = [
    { content: 'The new API endpoints are working great! Thanks for the quick implementation.', author: client3 },
    { content: 'Glad to hear it! Let us know if you need any adjustments.', author: agent3, parent: 0 },
    { content: 'Will do! One small thing - can we get webhook support for the new endpoints?', author: client3, parent: 1 },
    { content: 'That\'s on our roadmap for next month. I\'ll keep you posted!', author: agent3, parent: 2 },
  ]

  const clientRoomMessages = [
    { room: createdPrivateRooms[1], messages: acmeClientMessages },
    { room: createdPrivateRooms[2], messages: starflowClientMessages },
    { room: createdPrivateRooms[3], messages: novaClientMessages },
  ]

  for (const { room, messages } of clientRoomMessages) {
    const roomCreatedAt = room.createdAt
    let messageTime = addHours(roomCreatedAt, 2)
    const createdMessages: { id: string; index: number }[] = []
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      let parentMessageId = null
      
      if (msg.parent !== undefined) {
        const parentMsg = createdMessages.find(m => m.index === msg.parent)
        parentMessageId = parentMsg?.id || null
      }

      const created = await prisma.message.create({
        data: {
          roomId: room.id,
          userId: msg.author.id,
          content: msg.content,
          parentMessageId,
          createdAt: messageTime,
        },
      })
      
      createdMessages.push({ id: created.id, index: i })
      messageTime = addMinutes(messageTime, Math.random() * 60 + 10)
    }
  }

  // Support team room messages
  const supportTeamMessages = [
    { content: 'New ticket came in - password reset issue. I\'m handling it.', author: agent1 },
    { content: 'Got a billing complaint. Escalating to billing team.', author: agent2 },
    { content: 'Thanks for the update! Keep me posted on the resolution.', author: admin1, parent: 0 },
    { content: 'Anyone available to help with an SSO setup? Customer is stuck on step 2.', author: agent3 },
    { content: 'I can help! Send me the ticket details.', author: admin2, parent: 3 },
  ]

  // Reuse supportTeamRoom from earlier (line 369)
  const supportRoomCreatedAt = supportTeamRoom.createdAt
  let supportMessageTime = addHours(supportRoomCreatedAt, 1)
  const supportCreatedMessages: { id: string; index: number }[] = []
  
  for (let i = 0; i < supportTeamMessages.length; i++) {
    const msg = supportTeamMessages[i]
    let parentMessageId = null
    
    if (msg.parent !== undefined) {
      const parentMsg = supportCreatedMessages.find(m => m.index === msg.parent)
      parentMessageId = parentMsg?.id || null
    }

    const created = await prisma.message.create({
      data: {
        roomId: supportTeamRoom.id,
        userId: msg.author.id,
        content: msg.content,
        parentMessageId,
        createdAt: supportMessageTime,
      },
    })
    
    supportCreatedMessages.push({ id: created.id, index: i })
    supportMessageTime = addMinutes(supportMessageTime, Math.random() * 45 + 10)
  }

  // Ticket messages (with threading)
  for (const { room, data } of createdTickets) {
    const ticketCreatedAt = room.createdAt
    let messageTime = addHours(ticketCreatedAt, 1)

    // Create main message
    const mainMessage = await prisma.message.create({
      data: {
        roomId: room.id,
        userId: data.replies.find(r => !r.author.role || r.author.role === Role.USER)?.author.id || client1.id,
        content: data.mainMessage,
        createdAt: messageTime,
      },
    })

    messageTime = addMinutes(messageTime, data.replies[0]?.minutesLater || 10)

    // Create replies (some threaded, some linear)
    const ticketMessages = [mainMessage]
    
    for (let i = 0; i < data.replies.length; i++) {
      const reply = data.replies[i]
      const isThreaded = Math.random() > 0.3 // 70% chance of being a reply to previous message
      let parentId = null

      if (isThreaded && i > 0) {
        // Reply to the previous message in the thread
        parentId = ticketMessages[ticketMessages.length - 1]?.id || mainMessage.id
      } else {
        // Linear reply to main message
        parentId = mainMessage.id
      }

      const created = await prisma.message.create({
        data: {
          roomId: room.id,
          userId: reply.author.id,
          content: reply.content,
          parentMessageId: parentId,
          createdAt: addMinutes(ticketCreatedAt, reply.minutesLater),
        },
      })
      
      ticketMessages.push(created)
    }
  }

  console.log('✅ All messages created\n')

  console.log('🎉 SolaceDesk seed completed!')
  console.log('\n📊 Summary:')
  console.log(`   Users: ${createdUsers.length} (2 admins, 3 agents, 3 clients)`)
  console.log(`   Team Rooms: ${createdTeamRooms.length} (PUBLIC)`)
  console.log(`   Private Rooms: ${createdPrivateRooms.length}`)
  console.log(`   Ticket Rooms: ${createdTickets.length}`)
  console.log(`   Total Rooms: ${createdTeamRooms.length + createdPrivateRooms.length + createdTickets.length}`)
  console.log('\n🔑 Login Credentials:')
  console.log('   All users: demo123')
  console.log('   Admins: admin@solace.com, clara@solace.com')
  console.log('   Agents: jacob@solace.com, may@solace.com, ethan@solace.com')
  console.log('   Clients: client@acme.com, client@starflow.com, client@nova.com')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

