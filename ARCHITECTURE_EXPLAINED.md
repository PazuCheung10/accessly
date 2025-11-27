# Accessly Architecture Explanation

## Overview

Accessly is a **Forum + Chat hybrid platform** built with Next.js 15, combining real-time chat capabilities with forum-style discovery and organization. This document explains how the application is structured and how all the pieces work together.

## How Next.js Works (Frontend + Backend in One)

Next.js is a **full-stack framework** - it combines both frontend and backend in a single application. There is no separate frontend/backend - everything runs in one Next.js server.

### Frontend (Client-Side)
- **Location**: `src/app/` (pages/components)
- **Runs in**: Browser (React components)
- **Examples**:
  - `src/app/page.tsx` - Landing/home page
  - `src/app/chat/page.tsx` - Chat interface
  - `src/app/admin/page.tsx` - Admin dashboard
  - `src/components/` - Reusable React components

### Backend (Server-Side)
- **Location**: `src/app/api/` (route handlers)
- **Runs in**: Node.js server (same process as frontend)
- **Examples**:
  - `src/app/api/chat/messages/route.ts` - Chat message API
  - `src/app/api/auth/[...nextauth]/route.ts` - Authentication
  - `src/app/api/search/route.ts` - Full-text search API
  - `src/app/api/admin/users/route.ts` - User management API

### Custom Server with Socket.io

Accessly uses a **custom Node.js HTTP server** (`server/index.ts`) that:
- Runs Next.js application
- Attaches Socket.io server to the same HTTP server
- Enables real-time features (chat, presence, typing indicators)

```
┌─────────────────────────────────────────────┐
│      Custom Node.js HTTP Server             │
│         (server/index.ts)                   │
│         Port 3000                           │
├─────────────────────────────────────────────┤
│  Next.js App                                │
│  • Frontend Pages (React)                   │
│  • API Routes (/api/*)                      │
│  • Server Components                        │
├─────────────────────────────────────────────┤
│  Socket.io Server                           │
│  • WebSocket connections                    │
│  • Real-time message broadcasting           │
│  • Presence tracking                        │
│  • Typing indicators                        │
├─────────────────────────────────────────────┤
│  Database (Prisma ORM)                      │
│  • PostgreSQL connection                    │
│  • Query optimization                      │
└─────────────────────────────────────────────┘
```

### Running the Application

**Development (with Socket.io):**
```bash
pnpm dev:server
```
- Starts custom server with Next.js + Socket.io
- Single process on http://localhost:3000
- Handles both HTTP requests and WebSocket connections

**Development (Next.js only, no Socket.io):**
```bash
pnpm dev
```
- Standard Next.js dev server
- Socket.io features won't work
- Useful for frontend-only development

**Production:**
```bash
pnpm build
pnpm start
```
- Builds the entire app (frontend + backend)
- Runs custom server with Socket.io
- One Node.js process handles everything

**Demo Mode (One-Click Setup):**
```bash
pnpm demo
```
- Automatically sets up Docker services (PostgreSQL, Redis)
- Creates `.env` file with required variables
- Runs migrations and seeds demo data
- Starts the application

## Key Components

### Authentication & Authorization
- **NextAuth (Auth.js) v5**: Handles OAuth, email magic links, and credentials
- **Role-Based Access Control (RBAC)**: USER and ADMIN roles
- **Room-Level Permissions**: OWNER, MODERATOR, MEMBER roles per room
- **Session Management**: Secure cookie-based sessions

### Real-Time Communication
- **Socket.io**: WebSocket server for real-time features
- **Redis Adapter** (optional): Enables horizontal scaling across multiple instances
- **Features**:
  - Instant message delivery
  - Presence tracking (who's online)
  - Typing indicators
  - Room-based broadcasting

### Database & Search
- **PostgreSQL**: Primary database
- **Prisma ORM**: Type-safe database access
- **Full-Text Search**: PostgreSQL `tsvector` with GIN indexes
- **Complex Queries**: Support for `from:@user tag:tech` syntax

### State Management
- **Zustand**: Client-side state management
- **localStorage Persistence**: Survives browser restarts
- **Per-Room Caching**: Messages cached per room for instant switching
- **Scroll Position Memory**: Remembers exact scroll position per room

## Data Flow

1. **User Action** → React Component
2. **API Request** → `src/app/api/*/route.ts` handler
3. **Database Query** → Prisma ORM → PostgreSQL
4. **Socket.io Broadcast** → All connected clients in the room
5. **State Update** → Zustand store → UI re-render

## Directory Structure

```
accessly/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes (backend)
│   │   │   ├── auth/           # NextAuth handlers
│   │   │   ├── chat/           # Chat APIs (messages, rooms, presence)
│   │   │   ├── search/         # Full-text search API
│   │   │   └── admin/          # Admin APIs
│   │   ├── chat/               # Chat pages (frontend)
│   │   ├── admin/              # Admin dashboard (frontend)
│   │   └── layout.tsx          # Root layout
│   ├── components/             # React components
│   │   ├── ChatRoom.tsx        # Main chat interface
│   │   ├── MessageItem.tsx     # Message display
│   │   └── admin/              # Admin components
│   ├── lib/                    # Shared utilities
│   │   ├── prisma.ts           # Prisma client
│   │   ├── auth.ts             # NextAuth config
│   │   ├── io.ts               # Socket.io client
│   │   ├── rbac.ts             # Role-based access control
│   │   └── search.ts           # Search utilities
│   └── prisma/
│       ├── schema.prisma       # Database schema
│       └── migrations/         # Database migrations
├── server/
│   └── index.ts                # Custom HTTP server + Socket.io
├── docker-compose.yml          # Docker services (DB, Redis)
├── Dockerfile                  # Production Docker image
└── package.json
```

## Deployment Options

**⚠️ Important**: Accessly requires a **long-lived Node.js process** for Socket.io real-time features. Serverless platforms (Vercel, Netlify) are **not supported**.

### Recommended Platforms

**Option 1: Render (Recommended for Demo/Production)**
- Supports Docker and long-running processes
- Automatic SSL and health checks
- Built-in PostgreSQL and Redis
- Step-by-step guide in [docs/deploy.md](./docs/deploy.md)

**Option 2: Fly.io**
- Docker-based deployments with persistent connections
- Excellent WebSocket support
- Easy scaling: `fly scale count 3`
- Built-in Redis support

**Option 3: Railway**
- Docker-first platform
- One-click deployments from GitHub
- Built-in PostgreSQL and Redis
- Automatic deployments on push

**Option 4: Docker (Self-Hosting)**
- Full control over infrastructure
- Use `docker-compose.yml` for local development
- See [docs/deploy.md](./docs/deploy.md) for production setup

### NOT Recommended

- **❌ Vercel**: Serverless functions don't support Socket.io long-lived connections
- **❌ Netlify**: Serverless-only, no persistent connections

## What Needs Separate Containers?

**NOT needed:**
- ❌ Separate frontend container (it's part of Next.js)
- ❌ Separate backend container (it's part of Next.js)
- ❌ Separate API server (API routes are part of Next.js)

**REQUIRED:**
- ✅ PostgreSQL database (Docker or managed service)
- ✅ Redis (optional, for Socket.io horizontal scaling)

**Current Setup:**
- **One application** (Next.js) that does everything
- **One custom server** (`server/index.ts`) with Socket.io
- **One command** (`pnpm demo` or `pnpm dev:server`) starts it all
- **One port** (3000) serves everything

The "backend" and "frontend" are just different folders in the same codebase!

## Key Features Explained

### Forum + Chat Hybrid
- **Forum-Style Discovery**: Browse public rooms, search, filter by tags
- **Real-Time Chat**: Instant messaging with Socket.io
- **Threaded Conversations**: Reply to messages creating nested threads
- **Persistent Context**: All conversations searchable and archived

### Smart Caching
- Messages cached per room in Zustand store
- Scroll positions remembered per room
- Survives browser restarts via localStorage
- Instant room switching without refetching

### Full-Text Search
- PostgreSQL `tsvector` with GIN indexes
- Complex query syntax: `from:@user tag:tech content:bug`
- Searches across messages and rooms
- Relevance scoring and snippets

### Role-Based Access Control
- **Global Roles**: USER, ADMIN (system-wide)
- **Room Roles**: OWNER, MODERATOR, MEMBER (per-room)
- Server-side enforcement on all protected routes
- Flexible permission system

For more details, see the [README.md](./README.md) and [docs/deploy.md](./docs/deploy.md).
