import { PrismaClient, Role, RoomRole, RoomType, TicketStatus, TicketDepartment } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Seed historical data for realistic demo experience
 * 
 * This script adds:
 * - Historical audit logs (spread over past 2-3 months)
 * - Additional tickets with various statuses assigned to different admins
 * - Historical messages in ticket rooms from staff (some within last 30 days)
 * - Historical ticket status changes and assignments
 */

// Helper to generate random date within a range
function randomDateBetween(start: Date, end: Date): Date {
  const startTime = start.getTime()
  const endTime = end.getTime()
  const randomTime = startTime + Math.random() * (endTime - startTime)
  return new Date(randomTime)
}

// Helper to generate date N days ago
function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

// Helper to generate date N hours ago
function hoursAgo(hours: number): Date {
  const date = new Date()
  date.setHours(date.getHours() - hours)
  return date
}

// Sample ticket titles by department
const ticketTitles = {
  IT_SUPPORT: [
    'Cannot log in after password reset',
    'Email notifications not working',
    'App crashes on iOS device',
    'Two-factor authentication setup issue',
    'Session timeout too short',
    'Password reset link expired',
    'Account locked after multiple attempts',
    'Unable to upload profile picture',
    'Dark mode toggle not working',
    'Search functionality returns no results',
  ],
  BILLING: [
    'Question about subscription charges',
    'Invoice not received',
    'Payment method update failed',
    'Refund request for cancelled subscription',
    'Billing cycle change request',
    'Tax calculation seems incorrect',
    'Subscription renewal date confusion',
    'Payment declined but card is valid',
    'Prorated charge question',
    'Upgrade to annual plan',
  ],
  PRODUCT: [
    'Feature request: Export data to CSV',
    'Dark mode toggle request',
    'Mobile app performance issues',
    'Request for keyboard shortcuts',
    'Notification preferences missing',
    'Dashboard customization request',
    'Integration with Slack needed',
    'Bulk actions feature request',
    'Advanced search filters needed',
    'Report generation feature',
  ],
  GENERAL: [
    'Account deletion request',
    'Privacy policy clarification',
    'Terms of service question',
    'Data export request',
    'Account merge request',
    'General feedback submission',
    'Partnership inquiry',
    'Media kit request',
    'Press inquiry',
    'General support question',
  ],
}

// Sample ticket descriptions
const ticketDescriptions = [
  'I\'m experiencing an issue with this feature. Can someone help?',
  'This has been happening for a few days now. Any guidance would be appreciated.',
  'I tried the suggested solutions but the problem persists.',
  'This is affecting my workflow. Please prioritize.',
  'I\'ve included screenshots and error messages in my previous message.',
  'This seems to be a recurring issue. Can we investigate?',
  'I need this resolved as soon as possible. Thank you!',
  'I followed the documentation but still having issues.',
  'This worked before but stopped working after the latest update.',
  'I\'m not sure if this is a bug or expected behavior.',
]

// Sample staff responses
const staffResponses = [
  'Thanks for reporting this. I\'ve investigated and found the issue.',
  'I\'ve reproduced the problem and working on a fix.',
  'This should be resolved in the next update. I\'ll keep you posted.',
  'Can you provide more details about when this happens?',
  'I\'ll update you once we have a solution.',
  'I\'ve escalated this to our engineering team.',
  'I\'ve applied a temporary workaround. Let me know if this helps.',
  'I\'ve updated your account settings. Please try again.',
  'This is a known issue and we\'re working on a fix.',
  'I\'ve sent you an email with detailed instructions.',
  'I\'ve assigned this to our specialist team.',
  'I\'ve reviewed your account and everything looks correct.',
  'I\'ve created a ticket for our development team.',
  'I\'ve verified the issue and working on a solution.',
  'I\'ve updated the ticket status. Please check your email.',
]

// Sample follow-up messages
const followUpMessages = [
  'Thanks for the quick response!',
  'That worked, thank you!',
  'I\'m still experiencing the issue.',
  'Can you provide an ETA?',
  'I\'ve tried the suggested solution but no luck.',
  'This is resolved now, thanks!',
  'I have additional information to share.',
  'When can I expect an update?',
]

// Sample audit log reasons/metadata
const auditReasons = [
  'Violation of terms of service',
  'Spam content detected',
  'Inappropriate behavior',
  'Security concern',
  'User request',
  'Account compromise suspected',
  'Policy violation',
  'Routine cleanup',
]

async function main() {
  console.log('📜 Starting historical data seed...')
  console.log('   This will add realistic historical data for demo purposes\n')

  // Get existing users
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  })

  const admins = allUsers.filter(u => u.role === Role.ADMIN)
  const regularUsers = allUsers.filter(u => u.role === Role.USER)

  if (admins.length < 2) {
    console.error('❌ Need at least 2 admin users. Please run db:seed-demo first.')
    process.exit(1)
  }

  if (regularUsers.length < 5) {
    console.error('❌ Need at least 5 regular users. Please run db:seed-demo first.')
    process.exit(1)
  }

  console.log(`✅ Found ${admins.length} admins and ${regularUsers.length} regular users`)

  // Get existing tickets
  const existingTicketsRaw = await prisma.room.findMany({
    where: { type: RoomType.TICKET },
    select: { id: true, name: true, status: true, ticketDepartment: true, createdAt: true },
  })

  // Normalize existing tickets to match newTickets structure
  const existingTickets = existingTicketsRaw.map(t => ({
    id: t.id,
    name: t.name,
    status: t.status || TicketStatus.OPEN,
    department: t.ticketDepartment || TicketDepartment.GENERAL,
    assignedAdminId: '', // Will be looked up later
    createdAt: t.createdAt,
  }))

  console.log(`✅ Found ${existingTickets.length} existing tickets`)

  // ============================================
  // STEP 1: Create additional historical tickets
  // ============================================
  console.log('\n🎫 STEP 1: Creating additional historical tickets...')

  const newTickets: Array<{
    id: string
    name: string
    status: TicketStatus
    department: TicketDepartment
    assignedAdminId: string
    createdAt: Date
  }> = []

  // Create tickets spread over the past 90 days
  const now = new Date()
  const ninetyDaysAgo = daysAgo(90)

  // Create 20-30 additional tickets
  const ticketCount = 25
  const departments: TicketDepartment[] = [
    TicketDepartment.IT_SUPPORT,
    TicketDepartment.BILLING,
    TicketDepartment.PRODUCT,
    TicketDepartment.GENERAL,
  ]

  for (let i = 0; i < ticketCount; i++) {
    const department = departments[Math.floor(Math.random() * departments.length)]
    const titles = ticketTitles[department]
    const title = titles[Math.floor(Math.random() * titles.length)]
    const ticketName = `ticket-${department.toLowerCase()}-${Date.now()}-${i}`
    
    // Distribute statuses: 40% OPEN, 20% WAITING, 40% RESOLVED
    const statusRand = Math.random()
    let status: TicketStatus
    if (statusRand < 0.4) {
      status = TicketStatus.OPEN
    } else if (statusRand < 0.6) {
      status = TicketStatus.WAITING
    } else {
      status = TicketStatus.RESOLVED
    }

    // Random admin assignment
    const assignedAdmin = admins[Math.floor(Math.random() * admins.length)]
    
    // Create ticket at random time in past 90 days
    const createdAt = randomDateBetween(ninetyDaysAgo, now)

    // Random creator (regular user)
    const creator = regularUsers[Math.floor(Math.random() * regularUsers.length)]

    const ticket = await prisma.room.create({
      data: {
        name: ticketName,
        title: `[TICKET][${department}] ${title}`,
        description: ticketDescriptions[Math.floor(Math.random() * ticketDescriptions.length)],
        type: RoomType.TICKET,
        status,
        ticketDepartment: department,
        isPrivate: true,
        creatorId: creator.id,
        createdAt,
        updatedAt: createdAt,
      },
    })

    // Add creator as member
    await prisma.roomMember.create({
      data: {
        userId: creator.id,
        roomId: ticket.id,
        role: RoomRole.MEMBER,
      },
    })

    // Add assigned admin as OWNER
    await prisma.roomMember.create({
      data: {
        userId: assignedAdmin.id,
        roomId: ticket.id,
        role: RoomRole.OWNER,
      },
    })

    newTickets.push({
      id: ticket.id,
      name: ticketName,
      status,
      department,
      assignedAdminId: assignedAdmin.id,
      createdAt,
    })

    console.log(`   ✅ Created ticket: ${ticket.name} (${status}, ${department})`)
  }

  console.log(`✅ Created ${newTickets.length} additional tickets\n`)

  // ============================================
  // STEP 2: Add historical messages to tickets
  // ============================================
  console.log('💬 STEP 2: Adding historical messages to tickets...')

  const thirtyDaysAgo = daysAgo(30)
  let messagesInLast30Days = 0

  // Combine all tickets for message creation
  const allTicketsForMessages = [...existingTickets, ...newTickets]

  for (const ticket of allTicketsForMessages) {
    // Get ticket members
    const members = await prisma.roomMember.findMany({
      where: { roomId: ticket.id },
      include: { user: { select: { id: true, role: true } } },
    })

    const creator = members.find(m => m.role === RoomRole.MEMBER)?.user
    const assignedAdmin = members.find(m => m.role === RoomRole.OWNER)?.user

    if (!creator || !assignedAdmin) {
      console.log(`   ⚠️  Skipping ticket ${ticket.name} (missing creator or admin)`)
      continue
    }

    // Get ticket creation time
    const ticketData = await prisma.room.findUnique({
      where: { id: ticket.id },
      select: { createdAt: true },
    })
    if (!ticketData) continue

    const ticketCreatedAt = ticketData.createdAt
    const now = new Date()
    const ticketAge = now.getTime() - ticketCreatedAt.getTime()

    // Add 2-5 messages per ticket
    const messageCount = 2 + Math.floor(Math.random() * 4)
    let lastMessageTime = ticketCreatedAt

    for (let i = 0; i < messageCount; i++) {
      // First message is always from creator
      const isFirstMessage = i === 0
      const sender = isFirstMessage ? creator : (Math.random() < 0.7 ? assignedAdmin : creator)
      
      // Time between messages: 1-48 hours
      const hoursSinceLast = 1 + Math.random() * 47
      const messageTime = new Date(lastMessageTime.getTime() + hoursSinceLast * 60 * 60 * 1000)
      
      // Don't create messages in the future
      if (messageTime > now) break

      const content = isFirstMessage
        ? ticketDescriptions[Math.floor(Math.random() * ticketDescriptions.length)]
        : sender.role === Role.ADMIN
        ? staffResponses[Math.floor(Math.random() * staffResponses.length)]
        : followUpMessages[Math.floor(Math.random() * followUpMessages.length)]

      await prisma.message.create({
        data: {
          roomId: ticket.id,
          userId: sender.id,
          content,
          createdAt: messageTime,
        },
      })

      if (messageTime >= thirtyDaysAgo) {
        messagesInLast30Days++
      }

      lastMessageTime = messageTime
    }
  }

  console.log(`✅ Added messages to tickets (${messagesInLast30Days} in last 30 days)\n`)

  // ============================================
  // STEP 3: Create historical audit logs
  // ============================================
  console.log('📋 STEP 3: Creating historical audit logs...')

  // Get all tickets (including newly created ones) for audit log generation
  const allTicketsForAudit = await prisma.room.findMany({
    where: { type: RoomType.TICKET },
    select: { id: true, name: true, status: true },
  })

  const auditLogs: Array<{
    action: string
    actorId: string
    targetType: string | null
    targetId: string | null
    metadata: any
    createdAt: Date
  }> = []

  // Generate audit logs over past 90 days
  const auditLogCount = 80

  for (let i = 0; i < auditLogCount; i++) {
    const actor = admins[Math.floor(Math.random() * admins.length)]
    const createdAt = randomDateBetween(ninetyDaysAgo, now)

    // Distribute action types
    const actionRand = Math.random()
    let action: string
    let targetType: string | null
    let targetId: string | null
    let metadata: any = {}

    if (actionRand < 0.3) {
      // 30% ticket status changes
      action = 'ticket.status.change'
      const ticket = allTicketsForAudit[Math.floor(Math.random() * allTicketsForAudit.length)]
      targetType = 'room'
      targetId = ticket.id
      const statuses: TicketStatus[] = [TicketStatus.OPEN, TicketStatus.WAITING, TicketStatus.RESOLVED]
      const oldStatus = ticket.status || TicketStatus.OPEN
      const newStatus = statuses[Math.floor(Math.random() * statuses.length)]
      metadata = { oldStatus, newStatus, ticketTitle: ticket.name }
    } else if (actionRand < 0.5) {
      // 20% ticket assignments
      action = 'ticket.assign'
      const ticket = allTicketsForAudit[Math.floor(Math.random() * allTicketsForAudit.length)]
      targetType = 'room'
      targetId = ticket.id
      const newAssignee = admins[Math.floor(Math.random() * admins.length)]
      metadata = { assigneeId: newAssignee.id, assigneeName: newAssignee.name, ticketTitle: ticket.name }
    } else if (actionRand < 0.65) {
      // 15% message deletions
      action = 'message.delete'
      const ticket = allTicketsForAudit[Math.floor(Math.random() * allTicketsForAudit.length)]
      const messages = await prisma.message.findMany({
        where: { roomId: ticket.id },
        select: { id: true },
        take: 10,
      })
      if (messages.length > 0) {
        const message = messages[Math.floor(Math.random() * messages.length)]
        targetType = 'message'
        targetId = message.id
        metadata = { reason: auditReasons[Math.floor(Math.random() * auditReasons.length)] }
      } else {
        continue // Skip if no messages
      }
    } else if (actionRand < 0.75) {
      // 10% room edits
      action = 'room.edit'
      const ticket = allTicketsForAudit[Math.floor(Math.random() * allTicketsForAudit.length)]
      targetType = 'room'
      targetId = ticket.id
      metadata = { field: 'description', oldValue: 'Old description', newValue: 'Updated description' }
    } else if (actionRand < 0.85) {
      // 10% member role updates
      action = 'member.role.update'
      const ticket = allTicketsForAudit[Math.floor(Math.random() * allTicketsForAudit.length)]
      const members = await prisma.roomMember.findMany({
        where: { roomId: ticket.id },
        select: { userId: true },
      })
      if (members.length > 0) {
        const member = members[Math.floor(Math.random() * members.length)]
        targetType = 'member'
        targetId = member.userId
        metadata = { roomId: ticket.id, oldRole: 'MEMBER', newRole: 'MODERATOR' }
      } else {
        continue // Skip if no members
      }
    } else if (actionRand < 0.92) {
      // 7% user bans
      action = 'user.ban'
      const user = regularUsers[Math.floor(Math.random() * regularUsers.length)]
      targetType = 'user'
      targetId = user.id
      metadata = { reason: auditReasons[Math.floor(Math.random() * auditReasons.length)] }
    } else if (actionRand < 0.97) {
      // 5% user unbans
      action = 'user.unban'
      const user = regularUsers[Math.floor(Math.random() * regularUsers.length)]
      targetType = 'user'
      targetId = user.id
      metadata = {}
    } else {
      // 3% room deletes (for old resolved tickets)
      action = 'room.delete'
      const resolvedTickets = allTicketsForAudit.filter(t => t.status === TicketStatus.RESOLVED)
      if (resolvedTickets.length > 0) {
        const ticket = resolvedTickets[Math.floor(Math.random() * resolvedTickets.length)]
        targetType = 'room'
        targetId = ticket.id
        metadata = { reason: 'Ticket resolved and archived' }
      } else {
        continue // Skip if no resolved tickets
      }
    }

    auditLogs.push({
      action,
      actorId: actor.id,
      targetType,
      targetId,
      metadata,
      createdAt,
    })
  }

  // Batch insert audit logs
  for (const log of auditLogs) {
    try {
      await prisma.auditLog.create({
        data: log,
      })
    } catch (error) {
      // Skip if target doesn't exist (e.g., deleted room)
      console.log(`   ⚠️  Skipped audit log for ${log.action} (target may not exist)`)
    }
  }

  console.log(`✅ Created ${auditLogs.length} historical audit logs\n`)

  // ============================================
  // STEP 4: Update some ticket statuses with history
  // ============================================
  console.log('🔄 STEP 4: Creating ticket status change history...')

  // For some tickets, create status progression
  const ticketsToUpdate = allTicketsForAudit.filter(t => t.status !== TicketStatus.RESOLVED).slice(0, 10)

  for (const ticket of ticketsToUpdate) {
    const ticketData = await prisma.room.findUnique({
      where: { id: ticket.id },
      select: { createdAt: true },
    })
    if (!ticketData) continue

    const ticketCreatedAt = ticketData.createdAt
    const now = new Date()

    // Create status progression: OPEN -> WAITING -> RESOLVED
    const statuses: TicketStatus[] = [TicketStatus.OPEN, TicketStatus.WAITING, TicketStatus.RESOLVED]
    let currentStatus = ticket.status

    for (let i = 0; i < statuses.length - 1; i++) {
      const currentIndex = statuses.indexOf(currentStatus)
      if (currentIndex === -1 || currentIndex >= statuses.length - 1) break

      const nextStatus = statuses[currentIndex + 1]
      const timeBetween = (now.getTime() - ticketCreatedAt.getTime()) / (statuses.length - i)
      const statusChangeTime = new Date(ticketCreatedAt.getTime() + timeBetween * (i + 1))

      // Update ticket status
      await prisma.room.update({
        where: { id: ticket.id },
        data: { status: nextStatus, updatedAt: statusChangeTime },
      })

      // Create audit log for status change
      const assignedAdmin = await prisma.roomMember.findFirst({
        where: { roomId: ticket.id, role: RoomRole.OWNER },
        select: { userId: true },
      })

      if (assignedAdmin) {
        try {
          await prisma.auditLog.create({
            data: {
              action: 'ticket.status.change',
              actorId: assignedAdmin.userId,
              targetType: 'room',
              targetId: ticket.id,
              metadata: { oldStatus: currentStatus, newStatus: nextStatus, ticketTitle: ticket.name },
              createdAt: statusChangeTime,
            },
          })
        } catch (error) {
          // Skip if there's an issue
          console.log(`   ⚠️  Skipped audit log for ticket ${ticket.name}`)
        }
      }

      currentStatus = nextStatus
    }
  }

  console.log(`✅ Updated ${ticketsToUpdate.length} tickets with status history\n`)

  // ============================================
  // STEP 5: Summary
  // ============================================
  console.log('📊 Summary:')
  const totalTickets = await prisma.room.count({ where: { type: RoomType.TICKET } })
  const totalAuditLogs = await prisma.auditLog.count()
  const totalMessages = await prisma.message.count()
  const recentMessages = await prisma.message.count({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      room: { type: RoomType.TICKET },
    },
  })

  console.log(`   ✅ Total tickets: ${totalTickets}`)
  console.log(`   ✅ Total audit logs: ${totalAuditLogs}`)
  console.log(`   ✅ Total messages: ${totalMessages}`)
  console.log(`   ✅ Messages in tickets (last 30 days): ${recentMessages}`)

  // Staff analytics summary
  console.log('\n👥 Staff Analytics Preview:')
  for (const admin of admins) {
    const assignedTickets = await prisma.roomMember.count({
      where: {
        userId: admin.id,
        role: RoomRole.OWNER,
        room: { type: RoomType.TICKET },
      },
    })
    const recentTicketMessages = await prisma.message.count({
      where: {
        userId: admin.id,
        room: { type: RoomType.TICKET },
        createdAt: { gte: thirtyDaysAgo },
        deletedAt: null,
      },
    })
    console.log(`   ${admin.name || admin.email}: ${assignedTickets} tickets, ${recentTicketMessages} messages (30d)`)
  }

  console.log('\n✨ Historical data seed completed successfully!')
  console.log('\n💡 The system now has:')
  console.log('   - Realistic audit log history (past 90 days)')
  console.log('   - Additional tickets with various statuses')
  console.log('   - Historical messages in ticket rooms')
  console.log('   - Staff analytics data for all admins')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding historical data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

