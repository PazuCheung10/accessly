# SolaceDesk Demo Script for Recruiters

**Duration**: 5–7 minutes  
**Target Audience**: Technical recruiters, hiring managers, potential clients

---

## Pre-Demo Setup

1. **Start the application**:
   ```bash
   pnpm demo
   ```

2. **Login credentials**:
   - Admin: `admin@solace.com` / `demo123`
   - Agent: `jacob@solace.com` / `demo123`

---

## Demo Flow

### Opening (30 seconds)

> "SolaceDesk is an enterprise-grade helpdesk and team collaboration platform. It combines real-time chat, threaded conversations, ticket management, and full-text search into a single, cohesive experience. Let me show you the key features."

### 1. Authentication & Role-Based Access (1 minute)

**Action**: Sign in as `admin@solace.com` / `demo123`

**Points to highlight**:
- "Notice the secure authentication with NextAuth"
- "I'm logged in as an admin, which gives me access to admin features"
- "The system uses role-based access control - different users see different features"

**Navigate to**: Admin dashboard (`/admin`)

**Show**:
- User management table
- System statistics
- Observability dashboard

**Say**:
> "As an admin, I can see system-wide statistics, manage users, and view audit logs. Regular users don't have access to this."

### 2. Forum-Style Discovery (1 minute)

**Navigate to**: Home page (`/`)

**Show**:
- "My Rooms" section with last message previews
- "Discover" section with public rooms
- Room cards with tags, member counts, descriptions
- Search and filter functionality

**Say**:
> "This combines forum-style discovery with real-time chat. Users can browse public rooms, search by tags, and see activity at a glance. Notice how rooms are organized like a forum, but with instant chat capabilities."

**Action**: Click on `#engineering` room

### 3. Real-Time Chat with Threading (2 minutes)

**Show**:
- Message history with realistic conversations
- Threaded replies (click on a message to see replies)
- Message actions (edit, delete, reactions)
- Presence indicators (who's online)
- Typing indicators (if available)

**Say**:
> "This is real-time chat powered by Socket.io. Messages appear instantly for all users in the room. Notice the threading - you can reply to specific messages, creating nested conversations like Slack or Discord."

**Action**: 
- Send a test message
- Reply to an existing message (create a thread)
- Show message reactions

**Say**:
> "All of this happens in real-time. If another user is in this room, they'll see my message instantly. The threading system maintains context, and messages are searchable."

### 4. Ticket Workflow (1.5 minutes)

**Navigate to**: Tickets page or find a ticket room

**Show**:
- Ticket room with status badge (OPEN/WAITING/RESOLVED)
- Main complaint message
- Threaded agent responses
- Status changes

**Say**:
> "This demonstrates the helpdesk workflow. A client submits a ticket, which creates a ticket room. Agents can respond with threaded replies, update the status, and track the resolution. The entire conversation is searchable and auditable."

**Action**: 
- Show ticket status badge
- Show threaded agent responses
- Navigate to admin panel to show ticket management

### 5. Full-Text Search (1 minute)

**Navigate to**: Search page (`/search`)

**Action**: Search for something like "login" or "bug"

**Show**:
- Search results with snippets
- Relevance scoring
- Results from both messages and rooms

**Say**:
> "The search uses PostgreSQL's full-text search with complex query syntax. You can search by content, user, tags, and more. Notice how it shows snippets and relevance scores."

**Action**: Try a complex query like `from:@jacob tag:tech`

### 6. Technical Architecture (1 minute)

**Navigate to**: Any page, then explain

**Say**:
> "From a technical perspective, this demonstrates:
> - **Full-stack Next.js**: Server and client components working together
> - **Real-time communication**: Socket.io with optional Redis scaling
> - **Type safety**: Full TypeScript with Zod validation
> - **Database design**: PostgreSQL with Prisma ORM, full-text search indexes
> - **State management**: Zustand with localStorage persistence
> - **Testing**: Comprehensive test suite with Vitest
> - **Deployment**: Docker-ready, deployable to Render, Fly.io, Railway"

**Show** (if time permits):
- Open browser DevTools → Network tab
- Show WebSocket connection
- Show API requests

### Closing (30 seconds)

**Say**:
> "SolaceDesk demonstrates full-stack engineering capabilities: real-time communication, complex data relationships, search, observability, and enterprise features. The codebase is production-ready with comprehensive tests, type safety, and scalable architecture."

**Questions to be ready for**:
- **Q**: "How does this scale?"  
  **A**: "Socket.io supports horizontal scaling with Redis adapter. The database uses proper indexing for search. State is managed client-side with caching."

- **Q**: "What's the tech stack?"  
  **A**: "Next.js 15, TypeScript, PostgreSQL, Prisma, Socket.io, Tailwind CSS. All modern, production-ready technologies."

- **Q**: "How long did this take?"  
  **A**: "This represents several weeks of focused development, including architecture design, feature implementation, testing, and documentation."

---

## Key Talking Points

### Architecture
- **Single codebase**: Frontend and backend in one Next.js app
- **Custom server**: Socket.io integrated with Next.js HTTP server
- **Database**: PostgreSQL with full-text search (tsvector)
- **Real-time**: WebSocket connections for instant updates

### Features to Emphasize
1. **Forum + Chat hybrid**: Discovery like a forum, real-time like chat
2. **Threading**: Nested conversations with context
3. **Tickets**: Helpdesk workflow with status tracking
4. **Search**: Full-text search across messages and rooms
5. **RBAC**: Role-based access control (USER, ADMIN, room roles)
6. **Audit logging**: Complete audit trail for admin actions
7. **Observability**: Metrics and telemetry dashboard

### Code Quality
- TypeScript throughout
- Comprehensive test suite
- Proper error handling
- Validation with Zod
- Production-ready deployment setup

---

## Troubleshooting

**If something doesn't work**:
- Check that Docker services are running: `pnpm demo:db`
- Verify database is seeded: `pnpm db:seed-demo`
- Check browser console for errors
- Verify Socket.io connection in Network tab

**If search doesn't return results**:
- Make sure messages exist in the database
- Try a simpler query first
- Check that full-text search indexes are created

**If real-time features don't work**:
- Ensure you're using `pnpm dev:server` (not `pnpm dev`)
- Check Socket.io connection in browser DevTools
- Verify Redis is running (if using multiple instances)

---

## Post-Demo

**Offer to show**:
- Code structure and architecture
- Test suite
- Deployment setup
- API documentation

**Provide links**:
- GitHub repository
- Live demo (if deployed)
- Architecture documentation

