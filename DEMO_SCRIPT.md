# SolaceDesk Demo Script for Recruiters

**Duration**: 5-7 minutes  
**Target Audience**: Technical recruiters, hiring managers, potential clients

---

## Pre-Demo Setup

1. **Start the application**:
   ```bash
   pnpm dev:server
   ```

2. **Seed demo data** (if not already seeded):
   ```bash
   pnpm db:seed-demo
   ```

3. **Login credentials**:
   - Admin: `admin@solace.com` / `demo123`
   - Agent: `jacob@solace.com` / `demo123`
   - Client: `client@acme.com` / `demo123`

---

## Demo Flow

### 1. Introduction (30 seconds)

**What to say:**
> "SolaceDesk is an enterprise-grade helpdesk and team collaboration platform. It combines real-time chat, threaded conversations, ticket management, and full-text search into a single, cohesive experience. Let me show you the key features."

**What to show:**
- Landing page with room discovery
- Professional UI with dark theme

---

### 2. Authentication & Role-Based Access (1 minute)

**What to say:**
> "The platform supports multiple authentication methods and role-based access control. Users can be admins, agents, or clients, each with different permissions."

**What to show:**
1. Sign in as `admin@solace.com` / `demo123`
2. Navigate to `/admin` - show admin dashboard
3. Navigate to `/admin/telemetry` - show observability metrics
4. Navigate to `/admin/audit` - show audit log

**Key points:**
- Multi-provider auth (GitHub, Email, Credentials)
- RBAC enforcement
- Admin-only features

---

### 3. Threading System (1.5 minutes)

**What to say:**
> "One of our standout features is the threading system. Users can reply to specific messages, creating nested conversation threads. This is essential for helpdesk workflows where context matters."

**What to show:**
1. Navigate to `/chat?room=#engineering`
2. Show a message with replies
3. Click "Reply" on a message
4. Show the threaded structure
5. Expand/collapse threads
6. Show deep-linking: `/chat?room=#engineering&thread=messageId`

**Key points:**
- Hierarchical message structure
- Thread persistence (expanded state saved)
- Deep-linking to specific threads
- Visual thread indicators

---

### 4. Ticket Management System (1.5 minutes)

**What to say:**
> "The ticket system allows customers to submit support requests without logging in. Admins can track status, assign tickets, and respond in threaded conversations."

**What to show:**
1. Navigate to `/support` (public form, no auth)
2. Submit a sample ticket
3. Sign in as admin
4. Navigate to `/tickets`
5. Show ticket list with filters (OPEN/WAITING/RESOLVED)
6. Click a ticket to open it
7. Show ticket header with status badge
8. Update ticket status
9. Assign ticket to another admin

**Key points:**
- Public ticket submission
- Status tracking (OPEN/WAITING/RESOLVED)
- Admin assignment
- Threaded ticket conversations

---

### 5. Full-Text Search (1 minute)

**What to say:**
> "Our search is powered by PostgreSQL's full-text search with tsvector. It supports complex queries and highlights results with context."

**What to show:**
1. Use the global search bar in navbar
2. Search for "password reset"
3. Show search results page with:
   - Message snippets with highlighting
   - Parent thread context
   - Relevance scores
4. Try complex query: `from:@alice tag:billing before:2024-01-01`
5. Click a result - show deep-linking to exact thread position

**Key points:**
- PostgreSQL tsvector with GIN indexes
- Complex query syntax
- Result highlighting
- Deep-linking to results

---

### 6. Real-Time Features (1 minute)

**What to say:**
> "All messaging is real-time using Socket.io. Messages appear instantly, and we show typing indicators and presence."

**What to show:**
1. Open two browser windows (or use incognito)
2. Sign in as different users
3. Send a message in one window
4. Show it appearing instantly in the other
5. Show typing indicator
6. Show presence bar (online users)

**Key points:**
- Socket.io real-time communication
- Typing indicators
- Presence tracking
- Instant message delivery

---

### 7. Export & Audit Logging (1 minute)

**What to say:**
> "For enterprise clients, we provide comprehensive audit logging and export capabilities. Every action is tracked, and rooms can be exported in multiple formats."

**What to show:**
1. Navigate to `/admin/audit`
2. Show filterable audit log
3. Show JSON diff viewer
4. Navigate to a room
5. Click "Export" button
6. Show export options (JSON, HTML, PDF)
7. Download a sample export

**Key points:**
- Comprehensive audit trail
- Filterable by action, user, room
- Export in JSON, HTML, PDF
- Enterprise-grade compliance

---

### 8. Observability Dashboard (30 seconds)

**What to say:**
> "We built an observability dashboard to monitor system health, performance, and usage patterns."

**What to show:**
1. Navigate to `/admin/telemetry`
2. Show real-time metrics:
   - Messages per room per minute
   - Active socket connections
   - Socket latency (p50/p95)
   - CPU/Memory usage
   - Top active rooms
   - Slowest Prisma queries
3. Show auto-refresh (every 5 seconds)

**Key points:**
- Real-time system metrics
- Performance monitoring
- Query performance tracking
- Auto-refresh dashboard

---

## Closing (30 seconds)

**What to say:**
> "SolaceDesk demonstrates full-stack engineering capabilities: real-time communication, complex data relationships, search, observability, and enterprise features. The codebase is production-ready with comprehensive tests, type safety, and scalable architecture."

**What to show:**
- Quick view of project structure
- Mention test coverage
- Show package.json dependencies

---

## Technical Highlights to Mention

1. **Architecture**: Next.js 15 full-stack framework, single process
2. **Database**: PostgreSQL with Prisma ORM
3. **Real-time**: Socket.io with optional Redis scaling
4. **Search**: PostgreSQL tsvector with GIN indexes
5. **Testing**: Vitest with comprehensive test suite
6. **Type Safety**: Full TypeScript with Zod validation
7. **State Management**: Zustand with persistence
8. **Performance**: Optimized rendering, scroll restoration, message caching

---

## Common Questions & Answers

**Q: How does this compare to Slack/Discord?**  
A: SolaceDesk is purpose-built for helpdesk workflows with ticket management, audit logging, and enterprise features. It combines chat, threading, and support in one platform.

**Q: Can it scale?**  
A: Yes. Socket.io supports Redis adapter for horizontal scaling. Database uses proper indexing, and we implement cursor-based pagination for performance.

**Q: Is it production-ready?**  
A: Yes. The codebase includes comprehensive tests, error handling, rate limiting, audit logging, and observability. It's ready for deployment.

**Q: What's the tech stack?**  
A: Next.js 15, TypeScript, PostgreSQL, Prisma, Socket.io, Tailwind CSS, NextAuth. All modern, production-grade technologies.

---

## Troubleshooting

- **If rooms don't show**: Check `/api/debug/rooms` to verify user memberships
- **If messages don't appear**: Check Socket.io connection in browser console
- **If search fails**: Verify PostgreSQL tsvector indexes are created
- **If export fails**: Check Puppeteer installation (PDF export)

---

**End of Demo Script**

