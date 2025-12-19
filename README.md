# Accessly

---

## For recruiters / clients

This project demonstrates my ability to design and build a real-world SaaS product end-to-end:

- Realtime chat & presence powered by Socket.io  
- Helpdesk ticket workflow with threaded conversations  
- Public support form connected to ticket creation  
- Role-based access control (admin, agent, client)  
- Full-text search, observability tools, and audit logging  
- Complete SSR + client-side interactivity using Next.js 15

For a quick demonstration, see **DEMO_SCRIPT.md** — a 5–7 minute walkthrough I use in interviews.

---

## About This Project

**Accessly** is the name of the codebase.  
**SolaceDesk** is the product scenario used for demonstration.

SolaceDesk is an internal helpdesk workspace for a single company. Internal teams (engineering, design, product, support) collaborate in shared rooms and manage customer support tickets in one unified platform. The seed data reflects this scenario: team collaboration rooms and support ticket rooms with realistic activity.

Enterprise-grade realtime chat and helpdesk platform with role-based authentication, threaded conversations, ticket support, full-text search, observability dashboard, and comprehensive audit logging.

Built with Next.js 15, TypeScript, Tailwind CSS, NextAuth, Prisma, PostgreSQL, and Socket.io.

## 🚀 Quick Start (One-Click Demo)

**Clone and run in 3 steps:**

```bash
# 1. Clone the repository
git clone <repository-url>
cd accessly

# 2. Install dependencies
pnpm install

# 3. Run demo mode (automatically sets up everything!)
pnpm demo
```

That's it! The demo script will:
- ✅ Check Docker is installed and running
- ✅ Start PostgreSQL and Redis in Docker containers
- ✅ Create `.env` file with required variables (auto-generated)
- ✅ Run database migrations
- ✅ Seed realistic demo data with multiple teams, clients, ticket threads, and 150+ messages
- ✅ Start the application at http://localhost:3000

**Sign in with demo accounts:**
- `admin@solace.com` / `demo123`
- `clara@solace.com` / `demo123`
- `jacob@solace.com` / `demo123`
- `may@solace.com` / `demo123`
- `ethan@solace.com` / `demo123`

**Prerequisites:** Docker Desktop must be installed and running. [Download Docker Desktop](https://www.docker.com/products/docker-desktop)

> 💡 **No manual configuration needed!** The demo script automatically creates the `.env` file, generates secrets, and configures everything for you.

## Product Overview

**SolaceDesk** is an **internal helpdesk workspace** that combines team collaboration rooms with customer support ticket management in one unified platform.

### Internal Helpdesk Workspace

SolaceDesk provides a single place for internal teams to collaborate and manage customer support:

- **Team Collaboration Rooms**: Internal teams collaborate in public and private rooms with real-time chat, threaded conversations, and full-text search
- **Support Ticket Management**: Customer support tickets are created via public form, managed by admins, and handled through threaded conversations
- **Unified Experience**: Both team rooms and support tickets use the same chat interface, making it easy for staff to switch between collaboration and support work
- **Real-Time Communication**: Instant messaging with Socket.io, typing indicators, and presence tracking
- **Persistent Context**: All conversations are searchable and archived, maintaining context over time

### Key Differentiators

1. **Smart Caching**: Per-room message caching with Zustand persistence - switch rooms instantly without refetching
2. **Scroll Memory**: Exact scroll position remembered per room, even after browser restarts
3. **Incremental Loading**: Only fetches new messages since last visit, not entire history
4. **Flash-Free Navigation**: Smooth room switching without visual jumps or loading states
5. **Resilient State**: Survives tab switches, page refreshes, and OS tab purges
6. **Full-Text Search**: PostgreSQL tsvector with complex query syntax (`from:@alice tag:billing`)
7. **Enterprise Features**: RBAC, audit logging, observability dashboard, export capabilities

### Use Cases

- **Internal Team Collaboration**: Internal staff collaborate in public/private rooms with threaded discussions and search
- **Customer Support Management**: Support tickets created via public form, managed by admins with status tracking, department categorization, and threaded conversations
- **Unified Helpdesk**: Single workspace where internal teams can collaborate and handle customer support tickets in one place

## Architecture

**Next.js is a full-stack framework** - it combines frontend and backend in one application:

- **Frontend**: `src/app/` (pages/components) - React components, runs in browser
- **Backend**: `src/app/api/` (route handlers) - API endpoints, runs on Node.js server
- **Server**: Custom Node.js HTTP server with Socket.io (runs on port 3000)
- **Single Process**: One Next.js server handles both (runs on port 3000)

### Architecture Diagram

![Architecture Diagram](./docs/assets/architecture-diagram.svg)

**Visual Overview**: The diagram above shows the complete system architecture, from client browser through the Next.js server to PostgreSQL database.

**Key Components**:
- **Client Layer**: React UI, Socket.io client, Zustand store, localStorage persistence
- **Server Layer**: Next.js API routes, Socket.io server, Prisma ORM
- **Database Layer**: PostgreSQL with full-text search capabilities

See [ARCHITECTURE_EXPLAINED.md](./ARCHITECTURE_EXPLAINED.md) for detailed explanations.

### Data Flow

1. **User Action** → React Component → API Route Handler
2. **API Handler** → Prisma ORM → PostgreSQL
3. **Database Change** → Socket.io Broadcast → All Connected Clients
4. **Client Receives** → Zustand Store Update → UI Re-render

See [ARCHITECTURE_EXPLAINED.md](./ARCHITECTURE_EXPLAINED.md) for details.

## Feature Tour

### 1. Team Workspace - Internal Collaboration

The home page provides a workspace for internal team collaboration:

![Home Page](./docs/assets/screenshots/home-page.png)

**Features**:
- **My Rooms**: Quick access to team rooms you've joined with last message preview
- **Discover Section**: Browse public team rooms with search, tag filters, and sorting
- **Room Cards**: Display title, description, tags, member count, and last message snippet
- **Create Room**: Modal form to create new public or private team rooms
- **Support Link**: Quick access to submit support tickets

### 2. Chat Room - Threaded Conversations

Real-time chat with hierarchical threading support:

![Chat Room](./docs/assets/screenshots/chat-room.png)

**Features**:
- **Threaded Messages**: Reply to specific messages creating two-level threads (root + direct replies)
- **Expandable Threads**: Click to expand/collapse thread views
- **Deep-Linking**: URL parameters (`?thread=messageId`) auto-expand specific threads
- **Room Header**: Full metadata display with badges, tags, and member info
- **Message Actions**: Edit, delete, react with emojis
- **Presence Indicators**: See who's online in real-time
- **Typing Indicators**: Know when someone is typing

### 3. Support Tickets

Customer support ticket system with threaded conversations:

**Features**:
- **Public Submission**: Anyone can submit tickets via `/support` page (no authentication required)
- **Department Categorization**: Tickets are categorized by department (IT Support, Billing, Product, General)
- **Admin Management**: Tickets managed via `/tickets` page (admin only) with filtering and status controls
- **Status Tracking**: OPEN, WAITING, RESOLVED status with admin controls
- **Thread Support**: Full threading capabilities in ticket conversations
- **Ticket Chat Interface**: Tickets accessed via `/chat?room={ticketId}` with breadcrumb navigation back to ticket list
- **Separate from Team Rooms**: Tickets are managed separately and do not appear in team room lists

### 4. Admin Dashboard

Comprehensive admin panel for system management:

![Admin Dashboard](./docs/assets/screenshots/admin-dashboard.png)

**Features**:
- **User Management**: View and manage all users
- **System Statistics**: Total users, messages, rooms
- **Room Management**: Create and manage rooms
- **Observability**: Real-time metrics and performance monitoring
- **Audit Logs**: Comprehensive audit trail viewer

### 5. Observability Dashboard

Real-time system metrics and performance monitoring:

![Observability Dashboard](./docs/assets/screenshots/telemetry-dashboard.png)

**Features**:
- **Real-Time Metrics**: Messages per minute, active connections, socket latency
- **Performance Tracking**: CPU, memory usage, slow query detection
- **Top Rooms**: Most active rooms with clickable navigation
- **Time Series Charts**: 5-minute history with auto-refresh
- **Query Performance**: Track Prisma queries >100ms

### 6. Search Results

Full-text search across messages and rooms:

![Search Results](./docs/assets/screenshots/search-results.png)

**Features**:
- **Message Search**: Full-text search with snippets and highlighting
- **Room Search**: Search room titles, descriptions, and tags
- **Complex Queries**: `from:@alice tag:billing before:2024-01-01`
- **Parent Context**: See parent message for threaded replies
- **Deep-Linking**: Click results to jump to exact message position

## Design Decisions

### Caching Strategy

**Why Zustand with Persistence?**

Accessly uses Zustand with persist middleware for client-side state management:

- **Per-Room Caching**: Messages cached per room, enabling instant room switching
- **localStorage Persistence**: State survives tab switches, page refreshes, and browser restarts
- **Incremental Updates**: Only fetches new messages since last visit, not entire history
- **Empty Room Caching**: Even empty rooms are cached to prevent unnecessary refetches
- **Scroll Position Memory**: Exact scroll position remembered per room

**Trade-offs**:
- ✅ **Pros**: Instant navigation, reduced server load, better UX
- ⚠️ **Cons**: localStorage size limits (~5-10MB), requires cleanup for very large rooms

**Future Improvements**: Could implement LRU cache eviction for very large rooms.

### Scroll Position Restoration

**Why Custom Scroll Management?**

Accessly implements custom scroll restoration instead of relying on browser defaults:

- **Per-Room Memory**: Each room remembers its exact scroll position
- **Flash Prevention**: Container hidden during scroll restoration to prevent visual jumps
- **Anchored Pagination**: Loading older messages preserves viewport position
- **Tab Switch Resilient**: Scroll position preserved when switching browser tabs

**Implementation**:
- Scroll positions stored in Zustand with localStorage persistence
- `useLayoutEffect` for synchronous scroll restoration
- Container visibility managed to prevent flashes during restoration

**Why Not Browser Default?**
- Browser scroll restoration doesn't work well with dynamic content
- Doesn't handle per-room scroll positions
- Causes visual flashes during restoration

### RBAC (Role-Based Access Control)

**Why Two-Tier Role System?**

Accessly uses a two-tier role system:

1. **Global Roles** (USER, MODERATOR, ADMIN) - System-wide permissions
2. **Room Roles** (OWNER, MODERATOR, MEMBER) - Per-room permissions

**Benefits**:
- **Flexibility**: Admins can moderate system-wide, room owners manage their rooms
- **Granular Control**: Different permissions for different contexts
- **Scalability**: Room owners don't need admin privileges to manage their rooms

**Implementation**:
- Centralized `assertRole()` and `assertMembership()` functions
- Custom `InsufficientRoleError` for consistent error handling
- Server-side verification on all protected routes

### Sockets vs Serverless

**Why Socket.io Instead of Serverless Functions?**

Accessly requires a **long-lived Node.js process** for real-time features:

- **WebSocket Connections**: Socket.io requires persistent connections (not possible with serverless)
- **State Management**: Socket.io server maintains connection state and room memberships
- **Real-Time Broadcasting**: Instant message delivery to all room members
- **Presence Tracking**: Track online users across rooms
- **Typing Indicators**: Real-time typing status broadcast

**Deployment Requirements**:
- ✅ **Supported**: Fly.io, Render, Railway, AWS ECS, DigitalOcean App Platform
- ❌ **Not Supported**: Vercel (serverless), Netlify (serverless)

**Scaling Strategy**:
- **Single Instance**: Works for small to medium deployments
- **Horizontal Scaling**: Use Redis adapter for multiple instances
- **Load Balancing**: No sticky sessions needed with Redis adapter

**Why Not Serverless + WebSockets?**
- Serverless WebSocket solutions (AWS API Gateway, Cloudflare Workers) are more complex
- Higher latency and cost for real-time features
- Socket.io with Redis adapter is battle-tested and simpler

## Features

### Forum-Style Home Page
- **Room Discovery**: Browse public rooms with search, tag filters, and sorting
- **My Rooms**: Quick access to rooms you've joined
- **Room Cards**: Display title, description, tags, member count, last message preview
- **Create Room**: Modal form to create new public or private rooms
- **SSR + Client Interactions**: Fast initial load with server-side rendering, instant client-side filtering
- **Pagination**: Load more rooms with cursor-based pagination

### Authentication & Authorization
- **Multi-Provider Auth**: NextAuth with GitHub OAuth, Email (magic link), and Credentials (email/password)
- **RBAC**: Role-based access control (USER, ADMIN)
- **Room Roles**: OWNER, MODERATOR, MEMBER for fine-grained room permissions
- **Session Management**: JWT-based sessions with secure cookies
- **Protected Routes**: Server-side role verification

### Chat System
- **Realtime Chat**: Socket.io-powered chat with instant message delivery
- **Threading**: Reply to messages with two-level thread structure
  - Two-level hierarchy: root messages and their direct replies
  - Expandable/collapsible threads
  - Deep-linking to specific threads via URL parameters
  - Thread persistence (expanded state saved)
  - Reply count indicators
- **Room Types**: 
  - Public rooms (anyone can discover and join)
  - Private rooms (invite-only, hidden from discovery)
  - Support Tickets (TICKET) with status tracking (OPEN/WAITING/RESOLVED)
    - Created via public support form (`/support`)
    - Managed via tickets page (`/tickets` - admin only)
    - Accessible via direct URL (`/chat?room={ticketId}`)
    - **Note**: Tickets are separate from team rooms and do not appear in chat sidebar
- **Room Management**:
  - Create rooms with title, description, tags, and type
  - Edit room metadata (OWNER only)
  - Invite users to private rooms (OWNER/MODERATOR)
  - Remove members (OWNER/MODERATOR)
  - View member list with roles
- **Room Header**: 
  - Full metadata display: title, description, tags, type badge (PUBLIC/PRIVATE/TICKET)
  - Status badge for tickets (OPEN/WAITING/RESOLVED)
  - Department badge for tickets (IT Support, Billing, Product, General)
  - Breadcrumb navigation back to tickets list for ticket rooms
  - Inline editing for OWNER (title, description, tags)
  - Ticket-specific info: assigned owner, last responder, average response time
  - "Assign to..." button for ticket reassignment (admin only)
  - Visibility badges (Public/Private/Ticket)
  - Tag display
  - User role badge
  - Edit button (OWNER)
  - Invite button (OWNER/MODERATOR, hidden for TICKET)
  - Members button with count
- **Message Actions**:
  - Edit own messages (within 10 minutes)
  - Delete own messages (soft delete)
  - Emoji reactions (Slack/Discord-style with top-3 display + overflow)
  - Single active emoji per user (toggle behavior)
- **Presence Indicators**: Shows who's online in each room
- **Typing Indicators**: Real-time typing status broadcast
- **Message History**: Cursor-based pagination for efficient message loading
- **Smart Caching**: Per-room message caching with Zustand for instant room switching
- **Scroll Position Memory**: Remembers exact scroll position when switching between rooms
- **Flash-Free Navigation**: Smooth room switching without visual jumps or flashes
- **Incremental Loading**: Only fetches new messages since last visit for better performance
- **Anchored Scroll**: Preserves scroll position when loading older messages (pagination)
- **Auto-Join**: Automatically joins public rooms when navigating from discover page
- **Rate Limiting**: 
  - Message rate limiting: max 3 messages per 5 seconds per user
  - Support form rate limiting: max 3 submissions per 5 minutes per IP
  - Hard limit enforced on backend (in-memory, ready for Redis upgrade)

### Support Ticket System
- **Public Support Form**: `/support` page (no authentication required)
  - Submit tickets with name, email, subject, and message
  - Automatic ticket creation with OPEN status
  - First admin assigned as OWNER
  - Rate limiting to prevent spam
- **Ticket Management**: `/tickets` page (admin only)
  - View all support tickets
  - Filter by status (OPEN/WAITING/RESOLVED)
  - Update ticket status
  - Assign tickets to admins
  - Thread structure: first message is main issue, replies are threads
  - **Note**: Tickets are separate from team rooms and only accessible via the tickets page or direct URL (`/chat?room={ticketId}`)
- **Ticket Metrics**: 
  - Last responder tracking
  - Average response time calculation
  - Assigned owner display
- **Room Separation**:
  - Team rooms (PUBLIC/PRIVATE) appear in chat sidebar and home page
  - Tickets are managed separately and do not appear in the room list
  - Chat sidebar shows only PUBLIC and PRIVATE rooms for team collaboration

### Full-Text Search
- **PostgreSQL tsvector**: Fast full-text search with GIN indexes
- **Global Search Bar**: Available in navbar for quick access
- **Search Page**: `/search` with comprehensive results
- **Message Search**: 
  - Full-text search across message content
  - Message snippets with highlighting
  - Parent thread context for replies
  - Relevance scoring (ts_rank)
- **Room Search**: Full-text search across room titles, descriptions, and tags
- **Complex Query Syntax**:
  - `from:@alice` - Filter by user
  - `tag:billing` - Filter by tag
  - `before:2024-01-01` - Filter by date
  - `after:2024-01-01` - Filter by date
- **Deep-Linking**: Click results to jump to exact thread position

### Observability Dashboard
- **Admin Telemetry**: `/admin/telemetry` (admin only)
- **Real-Time Metrics**:
  - Messages per room per minute
  - Active socket connections
  - Socket latency (p50/p95)
  - Node.js process CPU and memory usage
  - Top 5 active rooms
  - Top 5 slowest Prisma queries (via middleware)
- **Visualizations**: 
  - Time series charts (5-minute history)
  - Bar charts for active rooms
  - Auto-refresh every 5 seconds
- **Clickable Rooms**: Navigate directly to chat threads from dashboard

### Operations & Observability (Phase 1, 2 & 3)
- **Structured Logging**: JSON-formatted logs with context (routeName, userId, requestId, duration)
- **Request Logging**: Automatic logging of all API requests with:
  - Request ID for correlation
  - Duration tracking
  - Slow request detection (>1000ms warnings)
  - User context (if authenticated)
- **Error Tracking**: 
  - Centralized error handler with Sentry integration
  - Request ID correlation between requests and errors
  - Client-side error boundary for React errors
- **Health Check**: `/api/health` endpoint for monitoring (DB and Redis status)
- **Error Boundaries**: React Error Boundaries catch render errors gracefully
- **Rate Limiting** (Phase 3):
  - Redis-backed rate limiting for multi-instance deployments
  - Automatic fallback to in-memory store if Redis unavailable
  - Multi-instance safe when Redis is configured
  - Applied to messages, support forms, and general API requests
- **Lightweight Metrics** (Phase 3):
  - 5xx error counters (total and per-route)
  - AI assistant failure tracking
  - Socket connection/disconnection counters
  - Developer metrics endpoint: `/api/dev/metrics`
- **Access Points**:
  - **Health Check**: `http://localhost:3000/api/health` (anyone)
  - **Developer Metrics**: `http://localhost:3000/api/dev/metrics` (dev mode or admin)
  - **Request Logs**: Server terminal (structured JSON)
  - **Telemetry Dashboard**: `/admin/telemetry` (admin only)
  - **Sentry Dashboard**: sentry.io (if `SENTRY_DSN` configured)
- **See**: `HOW_TO_VIEW_OBSERVABILITY.md` for detailed guide

### Audit Log System
- **Comprehensive Audit Trail**: `/admin/audit` (admin only)
- **Tracked Actions**:
  - Message deletion
  - Member removal
  - Ticket status changes
  - Room metadata edits
  - Ownership transfers
  - User bans/unbans
  - Room deletions
- **Audit Log Features**:
  - Time, user, action, target, and JSON diff
  - Filterable by action, user, target type, target ID
  - Cursor-based pagination
  - Expandable JSON metadata viewer
  - Color-coded action types
  - Clickable room links

### Dashboard & Admin
- **User Dashboard**: Personal stats (messages sent, rooms joined)
- **Admin Dashboard**: System-wide statistics (users, messages, rooms)
- **Admin Panel**: 
  - User management table
  - Room creation and management
  - System statistics
  - Observability dashboard
  - Audit log viewer
- **Role-Based UI**: Different views for USER vs ADMIN

### Technical Features
- **Type Safety**: Full TypeScript with Zod validation
- **State Management**: Zustand with persist middleware for resilient state (survives tab switches, refreshes, OS purges)
- **Server/Client Architecture**: Optimal Next.js App Router patterns (server components for data, client for interactivity)
- **State Persistence**: Chat messages, scroll positions, room cache, and expanded threads persist to localStorage
- **No Page Refreshes**: Clean navigation without full page reloads, even on tab switches
- **Testing**: Comprehensive test suite with Vitest
  - Unit tests for core functionality
  - API endpoint tests
  - Integration tests for threading, tickets, search, audit logs
- **Docker Support**: Multi-stage builds with docker-compose
- **Horizontal Scaling**: Redis adapter for Socket.io (optional)
- **Graceful Shutdown**: Proper cleanup of connections and resources
- **Performance**: Optimized rendering with scroll restoration and message caching
- **User Experience**: Instant scroll positioning, flash-free transitions, responsive design, resilient to browser events
- **Metrics Collection**: In-memory metrics store for observability (ready for Redis upgrade)
- **Query Performance**: Prisma middleware tracks slow queries (>100ms)
- **Operations Layer**: 
  - Structured logging with request correlation
  - Request duration tracking and slow request alerts
  - Error tracking with Sentry integration (optional)
  - Health check endpoint for monitoring
  - React Error Boundaries for client-side error handling
  - Redis-backed rate limiting (multi-instance safe)
  - Lightweight metrics collection (5xx errors, AI failures, socket events)
  - Developer metrics endpoint for debugging

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Full-Text Search**: PostgreSQL tsvector with GIN indexes
- **Authentication**: NextAuth (Auth.js) v5
- **Realtime**: Socket.io with optional Redis adapter
- **State Management**: Zustand with persist middleware (localStorage)
- **Validation**: Zod
- **Testing**: Vitest + Testing Library
- **Visualization**: Recharts for observability dashboard
- **Error Tracking**: Sentry (@sentry/nextjs) for error monitoring (optional)
- **Password Hashing**: bcryptjs
- **Date Formatting**: date-fns

## Getting Started

### Prerequisites

- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **pnpm** - Install with `npm install -g pnpm`
- **Docker Desktop** - [Download Docker Desktop](https://www.docker.com/products/docker-desktop) (required for demo mode)

> 💡 **For Demo Mode**: Only Docker Desktop is required. The demo script handles PostgreSQL, Redis, environment setup, migrations, and seeding automatically!

### Install

```bash
pnpm i
```

### Environment Setup

> 💡 **Skip this if using Demo Mode!** The `pnpm demo` command automatically creates the `.env` file for you.

**For manual setup:**

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

**Required environment variables:**
- `DATABASE_URL` - PostgreSQL connection string
  - For Docker: `postgresql://accessly:accessly_dev_password@localhost:5432/accessly`
  - For external DB: Your PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -hex 32`)
- `NEXTAUTH_URL` - Application URL (default: http://localhost:3000)

**Optional (for authentication providers):**
- `GITHUB_ID` and `GITHUB_SECRET` - GitHub OAuth
- `EMAIL_SERVER` and `EMAIL_FROM` - Email provider (magic link)
- Note: Credentials provider works without any additional setup

**Optional (for production):**
- `REDIS_URL` - Redis adapter for Socket.io horizontal scaling
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)

### Database Setup

```bash
# Generate Prisma client
pnpm prisma:gen

# Run migrations
pnpm prisma migrate dev

# Seed database (creates admin user, regular user, and sample rooms)
pnpm db:seed

# Or seed with realistic demo data (creates 5–8 users, a dozen rooms, and dozens of ticket replies)
pnpm db:seed-demo
```

**Demo Accounts:**
- Admin: `admin@solace.com` / `demo123`
- Admin: `clara@solace.com` / `demo123`
- User: `jacob@solace.com` / `demo123`
- User: `may@solace.com` / `demo123`
- User: `ethan@solace.com` / `demo123`

### 🎭 Demo Mode (One-Click Setup) - Recommended

**The easiest way to get started!** Demo Mode automatically handles everything:

1. ✅ Checks Docker is installed and running
2. ✅ Creates `.env` file with auto-generated secrets
3. ✅ Starts PostgreSQL and Redis via Docker Compose
4. ✅ Waits for services to be healthy
5. ✅ Runs database migrations
6. ✅ Generates Prisma client
7. ✅ Seeds realistic demo data with multiple teams, clients, ticket threads, and 150+ messages
8. ✅ Starts the application

**Prerequisites:**
- Docker Desktop installed and running
- Docker Compose available (included with Docker Desktop)

**Run Demo Mode:**
```bash
pnpm demo
```

**What happens:**
- Automatically creates `.env` file with:
  - `DATABASE_URL` (pointing to Docker PostgreSQL)
  - `AUTH_SECRET` (auto-generated secure secret)
  - `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` (localhost:3000)
- Starts PostgreSQL and Redis in Docker containers
- Sets up the database with migrations
- Seeds demo data (users, rooms, messages)
- Starts the app at http://localhost:3000

**No manual configuration required!** Everything is automated.

**Demo Accounts:**
Once the app starts, you can sign in with any of these accounts:
- **Admin**: `admin@solace.com` / `demo123`
- **Admin**: `clara@solace.com` / `demo123`
- **User**: `jacob@solace.com` / `demo123`
- **User**: `may@solace.com` / `demo123`
- **User**: `ethan@solace.com` / `demo123`

**Demo Data Includes:**
- Multiple users (admins, agents, clients)
- Various room types (team rooms, private rooms, tickets)
- Realistic message history with threaded conversations
- Room memberships and permissions
- Tags and room metadata

**Stop Demo Mode:**
Press `Ctrl+C` to stop the server. To stop Docker services:
```bash
pnpm demo:down
```

**Reset Demo Data:**
To completely reset and start fresh:
```bash
pnpm demo:reset
```

This will:
- Stop and remove Docker containers (including volumes)
- Restart everything with fresh data

### Development

**Option 1: Standard Next.js dev server (no Socket.io)**
```bash
pnpm dev
```

**Option 2: Custom server with Socket.io (recommended)**
```bash
pnpm dev:server
```

Visit http://localhost:3000

### Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# UI mode
pnpm test:ui
```

## Docker Support

### Quick Start with Docker Compose

**🎯 Recommended: Use Demo Mode (One-Click)**
```bash
# One-click demo setup (handles everything automatically)
pnpm demo
```

This automatically:
- Creates `.env` file with correct Docker database URL
- Starts PostgreSQL and Redis containers
- Runs migrations and seeds data
- Starts the application

**Manual Docker Compose Setup (Advanced):**

If you want to manually control Docker services:

```bash
# Start only database and Redis (for local development)
pnpm demo:db
# Or: docker-compose up -d db redis

# Stop services
pnpm demo:down
# Or: docker-compose down

# Reset everything (removes volumes, fresh start)
pnpm demo:reset
# Or: docker-compose down -v && pnpm demo
```

**Full Docker Compose (All Services):**
```bash
# Start all services (PostgreSQL, Redis, Next.js app)
docker-compose up -d

# Run migrations
docker-compose exec app pnpm prisma migrate deploy

# Seed database
docker-compose exec app pnpm db:seed

# Or seed demo data
docker-compose exec app pnpm db:seed-demo

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Docker Services

- **app**: Next.js application with Socket.io (port 3000)
- **db**: PostgreSQL database (port 5432)
- **redis**: Redis for Socket.io scaling (port 6379, optional)

### Manual Docker Build

```bash
# Build image
docker build -t accessly .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="..." \
  accessly
```

## Deployment

**⚠️ Important**: This application uses a custom Node.js server with Socket.io. It requires a **long-lived Node.js process**, not serverless functions.

### Recommended Platforms

- **Fly.io**: Excellent for Docker deployments with persistent connections
  - Docker-based, supports WebSockets natively
  - Easy scaling with `fly scale count`
  - Built-in Redis support
- **Render**: Supports Docker and long-running processes
  - Docker or native Node.js deployments
  - Automatic SSL and health checks
  - Redis add-on available
- **Railway**: Docker-first platform, great for Node.js apps
  - One-click deployments from GitHub
  - Built-in PostgreSQL and Redis
  - Automatic deployments on push
- **AWS ECS/EC2**: Self-hosted with Docker
  - Full control over infrastructure
  - Use Application Load Balancer for WebSocket support
  - ElastiCache for Redis
- **DigitalOcean App Platform**: Supports Docker deployments
  - Managed platform with Docker support
  - Managed databases and Redis available

### NOT Recommended

- **❌ Vercel**: Serverless functions don't support Socket.io long-lived connections
- **❌ Netlify**: Serverless-only, no persistent connections

### Setup & Deploy Notes

**For Long-Lived Node Process:**

1. **Environment Variables**:
   ```bash
   DATABASE_URL=postgresql://...
   AUTH_SECRET=...
   NEXTAUTH_URL=https://your-domain.com
   REDIS_URL=redis://...  # Optional, for horizontal scaling
   PORT=3000
   ```

2. **Build Command**:
   ```bash
   pnpm build
   ```

3. **Start Command**:
   ```bash
   pnpm start
   ```

4. **Health Check Endpoint**:
   - Use `/api/status` for health checks
   - Returns 200 OK when database is connected

5. **Database Migrations**:
   ```bash
   pnpm prisma migrate deploy
   ```

6. **Scaling with Redis**:
   - Set `REDIS_URL` environment variable
   - Socket.io automatically uses Redis adapter
   - Scale to multiple instances behind load balancer
   - No sticky sessions needed

See [docs/deploy.md](./docs/deploy.md) for detailed deployment instructions.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API route handlers
│   │   ├── auth/          # NextAuth handlers
│   │   ├── chat/          # Chat API (messages, rooms)
│   │   │   ├── rooms/     # Room management
│   │   │   │   ├── discover/    # Public room discovery
│   │   │   │   ├── [roomId]/   # Room-specific operations
│   │   │   │   │   ├── join/   # Join room
│   │   │   │   │   ├── leave/  # Leave room
│   │   │   │   │   ├── invite/ # Invite users
│   │   │   │   │   ├── members/ # Member management
│   │   │   │   │   └── route.ts # Get/update room details
│   │   │   ├── messages/  # Message CRUD
│   │   │   │   └── [messageId]/ # Message actions (edit, delete, reactions)
│   │   │   └── dm/        # Direct message creation (disabled)
│   │   ├── support/        # Public support tickets
│   │   │   └── tickets/   # Ticket creation (no auth)
│   │   ├── tickets/       # Ticket management (admin)
│   │   │   └── [ticketId]/ # Ticket operations (status, assign)
│   │   ├── search/        # Full-text search
│   │   ├── admin/         # Admin endpoints
│   │   │   ├── users/     # User management
│   │   │   ├── telemetry/ # Observability metrics
│   │   │   └── audit/     # Audit log retrieval
│   │   ├── users/         # User search (for invites)
│   │   └── status/        # Health check endpoint
│   ├── (auth)/            # Auth pages (sign-in, error)
│   ├── page.tsx           # Forum-style home page (room discovery)
│   ├── chat/              # Chat interface
│   │   ├── page.tsx       # Server component (reads searchParams)
│   │   └── ChatPageClient.tsx # Client component (interactive logic)
│   ├── support/           # Public support form
│   ├── search/            # Search results page
│   ├── tickets/           # Ticket management (admin)
│   ├── admin/             # Admin panel (SSR, ADMIN only)
│   │   ├── telemetry/     # Observability dashboard
│   │   └── audit/         # Audit log viewer
│   └── status/            # Health check page
├── components/            # React components
│   ├── rooms/            # Room-related components
│   │   ├── RoomCard.tsx      # Room card for discovery
│   │   ├── RoomFilters.tsx    # Search, tags, sort filters
│   │   ├── RoomHeader.tsx     # Room header with badges and actions
│   │   ├── HomePageClient.tsx # Client-side forum page
│   │   └── CreateRoomButton.tsx # Create room modal
│   ├── admin/            # Admin components
│   │   ├── TelemetryDashboard.tsx # Observability dashboard
│   │   └── AuditLogDashboard.tsx  # Audit log viewer
│   ├── tickets/          # Ticket components
│   │   └── TicketsList.tsx # Ticket list with filtering
│   ├── ChatRoom.tsx       # Chat room component with threading
│   ├── MessageItem.tsx    # Individual message display with actions
│   ├── ThreadView.tsx     # Thread replies display
│   ├── PresenceBar.tsx    # Online users indicator
│   ├── SearchBar.tsx      # Global search bar
│   ├── SearchResults.tsx  # Search results display
│   ├── Navbar.tsx         # Navigation bar with search
│   └── ...
├── lib/                   # Utilities
│   ├── auth.ts            # NextAuth configuration
│   ├── env.ts             # Environment validation
│   ├── prisma.ts          # Prisma client singleton (with query tracking middleware)
│   ├── rbac.ts            # Role-based access control
│   ├── socket.ts          # Socket.io client
│   ├── validation.ts      # Zod schemas
│   ├── chatStore.ts       # Zustand store for chat state (with threading)
│   ├── scroll.ts          # Scroll utilities (preserve, restore)
│   ├── io.ts              # Socket.io server singleton
│   ├── rateLimit.ts       # Rate limiting (messages, support forms)
│   ├── audit.ts           # Audit logging helpers
│   ├── search.ts          # Search query parsing and utilities
│   ├── metrics.ts         # Metrics collection service
│   └── telemetry.ts       # Telemetry tracking utilities
├── data/                  # Seed scripts
│   ├── seed.ts            # Basic seed (admin + user)
│   ├── seed-demo.ts       # Demo data (teams, clients, tickets, threaded messages)
│   └── diagnose-chat.ts   # Diagnostic tools
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   │   ├── audit.test.ts      # Audit logging tests
│   │   ├── threading.test.ts  # Threading structure tests
│   │   ├── tickets.test.ts    # Ticket logic tests
│   │   ├── rateLimit.test.ts  # Rate limiting tests
│   │   └── ...
│   ├── api/               # API endpoint tests
│   │   ├── audit.test.ts           # Audit API tests
│   │   ├── audit-integration.test.ts # Integration tests
│   │   ├── threading.test.ts       # Threading API tests
│   │   ├── tickets.test.ts         # Ticket API tests
│   │   └── ...
│   └── components/         # Component tests
├── prisma/                # Prisma schema and migrations
│   └── migrations/        # Database migrations
│       ├── ..._add_threading/
│       ├── ..._add_ticket_support/
│       └── ..._add_fulltext_search/
└── server/                # Custom Node.js server entry
    └── index.ts           # HTTP server + Socket.io setup (with telemetry)
```

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get current session

### Rooms
- `GET /api/chat/rooms` - List user's joined rooms
- `POST /api/chat/rooms` - Create room (any authenticated user)
- `GET /api/chat/rooms/discover` - Discover public rooms (search, filter, sort, pagination)
- `GET /api/chat/rooms/available` - List available public rooms (not joined yet)
- `GET /api/chat/rooms/[roomId]` - Get room details with membership info
- `PATCH /api/chat/rooms/[roomId]` - Update room metadata (OWNER only)
- `POST /api/chat/rooms/[roomId]/join` - Join a public room
- `POST /api/chat/rooms/[roomId]/leave` - Leave a room
- `POST /api/chat/rooms/[roomId]/invite` - Invite user to private room (OWNER/MODERATOR)
- `GET /api/chat/rooms/[roomId]/members` - List room members
- `DELETE /api/chat/rooms/[roomId]/members?userId=...` - Remove member (OWNER/MODERATOR)

### Messages
- `GET /api/chat/messages?roomId=...` - Get messages (paginated with cursor/after, hierarchical structure)
- `POST /api/chat/messages` - Send message (supports parentMessageId for threading)
- `PATCH /api/chat/messages/[messageId]` - Edit message (author only, within 10 minutes)
- `DELETE /api/chat/messages/[messageId]` - Delete message (author only, soft delete)
- `POST /api/chat/messages/[messageId]/reactions` - Add/remove emoji reaction


### Support Tickets
- `POST /api/support/tickets` - Create support ticket (public, no auth)
- `GET /api/tickets` - List all tickets (admin only, filterable by status)
- `PATCH /api/tickets/[ticketId]/status` - Update ticket status (admin only)
- `POST /api/tickets/[ticketId]/assign` - Assign ticket to admin (admin only)

### Search
- `POST /api/search` - Full-text search across messages and rooms
  - Query parsing: supports `from:`, `tag:`, `before:`, `after:` syntax
  - Returns message snippets with highlighting
  - Includes parent thread context
  - Returns relevance scores

### Admin
- `GET /api/admin/users?role=...` - List users (admin only, filterable by role)
- `GET /api/admin/telemetry` - Get observability metrics (admin only)
- `GET /api/admin/audit` - Get audit logs (admin only, filterable)

### Users
- `GET /api/users/search?email=...` - Search user by email (for invites)

### System
- `GET /api/health` - Health check (DB, Redis status) - unauthenticated
- `GET /api/dev/metrics` - Developer metrics (5xx errors, AI failures, socket events) - dev mode or admin
- `GET /api/debug/session` - Debug session info
- `GET /api/debug/rooms` - Debug room/membership info

## Realtime Communication

This project uses **Socket.io** for realtime chat and presence:

- **Messages**: Broadcast to room members via Socket.io events (`message:new`)
- **Presence**: Shows online users in each room
- **Room Events**: `room:join` and `room:leave` events for presence tracking
- **Scaling**: For production, use Redis adapter with `REDIS_URL` environment variable
- **Connection**: Socket.io available at `/socket.io` path

See [docs/scaling.md](./docs/scaling.md) for scaling strategies.

## User Interface

### Team Workspace
- **My Rooms Section**: Displays PUBLIC and PRIVATE rooms you've joined with last message preview
- **Discover Section**: Browse public rooms with:
  - Search bar (title, description)
  - Tag filter chips
  - Sort options (Most Active, Newest, Most Members)
  - Pagination (Load More button)
- **Room Cards**: Show title, description, tags, member count, message count, last message snippet, visibility badge
- **Create Room**: Modal form accessible from header

### Chat Page
- **Sidebar**: List of joined PUBLIC and PRIVATE rooms (tickets accessible via `/tickets` page)
- **Chat Area**: Messages with threading support
  - Root messages with reply buttons
  - Expandable/collapsible threads
  - Thread view with indentation
  - Reply count indicators
  - Deep-linking to specific threads
- **Room Header**: 
  - Room title and description (editable by OWNER)
  - Visibility badge (Public/Private/Ticket)
  - Status badge for tickets (OPEN/WAITING/RESOLVED)
  - Tag badges
  - User role badge
  - Ticket info: assigned owner, last responder, average response time
  - Edit button (OWNER only)
  - Assign button (tickets, admin only)
  - Invite button (OWNER/MODERATOR, hidden for TICKET)
  - Members button
- **Message Input**: 
  - Send messages with realtime delivery
  - Reply to messages (creates thread)
  - "Replying to..." indicator
- **Message Actions**:
  - Edit button (author only, within 10 minutes)
  - Delete button (author only)
  - Emoji reaction picker (hover to reveal)
  - Reaction badges (top-3 + overflow)

### Search Page
- **Global Search Bar**: Available in navbar
- **Search Results**: 
  - Message results with snippets and highlighting
  - Room results with descriptions
  - Parent thread context for replies
  - Clickable results navigate to exact thread position
- **Complex Query Support**: `from:@alice tag:billing before:2024-01-01`

### Admin Pages
- **Telemetry Dashboard**: `/admin/telemetry`
  - Real-time system metrics
  - Time series charts
  - Top active rooms
  - Slow query tracking
- **Audit Log**: `/admin/audit`
  - Comprehensive audit trail
  - Filterable table view
  - JSON diff viewer
  - Clickable room links

## Chat Features

### Threading
- **Reply System**: Click reply button on any message to start a thread
- **Two-Level Structure**: Messages organized as parent-child relationships (root message + direct replies)
  - Currently supports 2 levels: root messages and their direct replies
  - Root messages shown with reply count
  - Expandable/collapsible threads
  - Indented replies with visual thread line
- **Thread Persistence**: Expanded thread state saved to localStorage
- **Deep-Linking**: URL parameters (`?thread=messageId`) auto-expand threads
- **Real-Time Updates**: New replies auto-expand if thread is already open
- **Thread Context**: Search results show parent message context

### Message Caching & State Persistence
- Messages are cached per room using Zustand with persist middleware
- **Persistent Storage**: Chat state (messages, scroll positions, cursors, expanded threads) saved to localStorage
- **Resilient to Browser Events**: State survives tab switches, page refreshes, and OS tab purges
- Switching rooms is instant when messages are already cached
- Only fetches new messages since last visit
- Empty rooms are cached to prevent unnecessary refetches
- **No Data Loss**: Unsent messages and scroll positions persist across sessions

### Scroll Position
- Scroll position is remembered for each room and persisted to localStorage
- Returns to exact previous position when switching back (even after browser restart)
- No flash or visual jumps during room navigation
- Instant scroll to bottom on first visit (no animation, hidden during scroll)
- Container visibility managed to prevent flashes
- **Tab Switch Resilient**: Scroll position preserved when switching browser tabs

### Pagination
- Load older messages with anchored scroll (preserves viewport)
- Incremental loading of newer messages
- Efficient cursor-based pagination
- Only shows "Loading older messages" indicator when fetching

## Room System

### Room Types
- **PUBLIC**: Discoverable in forum, anyone can join
- **PRIVATE**: Hidden from discovery, invite-only
- **TICKET**: Support ticket with status tracking (OPEN/WAITING/RESOLVED)
  - Created via public support form (`/support`)
  - Managed via tickets page (`/tickets` - admin only)
  - Accessible via direct URL (`/chat?room={ticketId}`)
  - **Note**: Tickets are separate from team rooms and do not appear in chat sidebar

### Room Roles
- **OWNER**: Created the room, can edit metadata, invite/remove members
- **MODERATOR**: Can invite/remove members (except OWNER)
- **MEMBER**: Regular member, can send messages

### Room Features
- **Title & Description**: Editable by OWNER
- **Tags**: Array of tags for categorization and filtering
- **Member Count**: Shows number of members
- **Last Message Preview**: Shows most recent message snippet with author and time
- **Creator**: Tracks who created the room
- **Metadata Editing**: OWNER can update title, description, tags (with audit logging)
- **Member Management**: OWNER/MODERATOR can invite and remove members
- **Ticket Features**:
  - Status tracking (OPEN/WAITING/RESOLVED)
  - Admin assignment
  - Response metrics (last responder, average response time)
  - Public submission form (no auth required)

### Room Discovery
- **Search**: Full-text search across title, name, description
- **Tag Filters**: Click tags to filter rooms
- **Sorting**: 
  - Most Active (by message count)
  - Newest (by creation date)
  - Most Members (by member count)
- **Pagination**: Cursor-based pagination for performance

## Development Scripts

```bash
# Development
pnpm dev              # Next.js dev server (no Socket.io)
pnpm dev:server       # Custom server with Socket.io

# Build
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm prisma:gen       # Generate Prisma client
pnpm prisma:migrate   # Run migrations (dev)
pnpm prisma:deploy    # Deploy migrations (production)
pnpm db:seed          # Seed database (basic)
pnpm db:seed-demo     # Seed database (creates 5–8 users, a dozen rooms, and dozens of ticket replies)
pnpm db:check         # Check user memberships
pnpm db:diagnose      # Comprehensive diagnostics
pnpm demo             # Quick demo: migrate + seed-demo + start

# Testing
pnpm test             # Run tests
pnpm test:watch       # Watch mode
pnpm test:ui          # UI mode

# Checks
pnpm check:core       # Check @auth/core version
pnpm check:client-imports  # Check for server imports in client
pnpm check:ssg        # Check SSG safety
```

## Navigation Flow

1. **After Login** → Redirects to Team Workspace (`/`)
2. **Team Workspace** → Internal collaboration rooms and customer support tickets in one place
3. **Click Room Card** → Navigates to `/chat?room={roomId}` (auto-joins if public)
4. **Chat Page** → Server component reads URL params, passes to client component
5. **Chat Interface** → Shows only joined rooms, full chat interface with persistent state
6. **Discover Button** → Links back to home page for finding new rooms

## Architecture Improvements

### Server/Client Component Split
- **`/chat/page.tsx`**: Server component that reads `searchParams` synchronously
- **`/chat/ChatPageClient.tsx`**: Client component with all interactive logic
- **Benefits**: 
  - No Promise-based searchParams handling in client
  - Prevents unnecessary re-mounts on tab switches/resizes
  - Cleaner separation of concerns

### State Persistence
- **Zustand Persist Middleware**: All chat state persisted to localStorage
- **Survives**: Tab switches, page refreshes, browser restarts, OS tab purges
- **Persisted Data**: Messages, scroll positions, pagination cursors, last fetched timestamps
- **Storage Key**: `accessly-chat-store`

### Performance Optimizations
- **No `router.refresh()` calls**: All navigation uses `router.push()` with URL params
- **Optimized useEffect dependencies**: Depend on `status` instead of entire `session` object
- **Reduced re-renders**: Client component tree doesn't remount on benign changes
- **Stable state**: Zustand persist prevents state loss during browser events

## Demo Script

For recruiters and potential clients, we provide a comprehensive demo script that walks through all key features.

**See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for the complete 5-7 minute demo flow.**

Quick demo steps:
1. Start server: `pnpm dev:server`
2. Seed data: `pnpm db:seed-demo`
3. Login: `admin@solace.com` / `demo123`
4. Follow the demo script to showcase:
   - Threading system
   - Ticket management
   - Full-text search
   - Real-time features
   - Export & audit logging
   - Observability dashboard

## Screenshots

Screenshots are available in the [Feature Tour](#feature-tour) section above. All screenshots are located in `docs/assets/screenshots/`:

- `home-page.png` - Forum-style room discovery page
- `chat-room.png` - Chat interface with threaded conversations
- `tickets-page.png` - Ticket management interface
- `admin-dashboard.png` - Admin dashboard with user management
- `telemetry-dashboard.png` - Observability dashboard with metrics
- `search-results.png` - Search results with highlighting

> **Note**: Screenshots are placeholders. Replace with actual screenshots from your running application.

## Testing

### Test Coverage

The project includes comprehensive test coverage:

- **Unit Tests**: Core utilities, helpers, and business logic
- **API Tests**: All API endpoints with authentication and authorization
- **Component Tests**: React components with user interactions
- **Integration Tests**: End-to-end workflows (threading, tickets, search)

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (development)
pnpm test:watch

# UI mode (interactive)
pnpm test:ui

# Coverage report
pnpm test:coverage
```

### Test Structure

```
src/tests/
├── unit/              # Unit tests for utilities
│   ├── audit.test.ts
│   ├── threading.test.ts
│   ├── tickets.test.ts
│   ├── rateLimit.test.ts
│   ├── validation.test.ts
│   └── search.test.ts
├── api/               # API endpoint tests
│   ├── audit.test.ts
│   ├── threading.test.ts
│   ├── tickets.test.ts
│   ├── messages.test.ts
│   └── search.test.ts
└── components/         # Component tests
    ├── ThreadView.test.tsx
    ├── MessageItem.test.tsx
    ├── SearchResults.test.tsx
    └── ChatRoom.test.tsx
```

### Key Test Scenarios

**Threading Tests:**
- Creating threaded replies
- Expanding/collapsing threads
- Deep-linking to threads
- Thread persistence

**Search Tests:**
- Full-text search queries
- Result highlighting
- Complex query syntax (`from:`, `tag:`, `before:`)
- Snippet extraction

**API Tests:**
- Authentication & authorization
- Rate limiting
- Error handling
- Data validation

## License

MIT
