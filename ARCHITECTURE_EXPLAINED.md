# Accessly Architecture Explanation

## How Next.js Works (Frontend + Backend in One)

Next.js is a **full-stack framework** - it combines both frontend and backend in a single application.

### Frontend (Client-Side)
- **Location**: `src/app/` (pages/components)
- **Runs in**: Browser (React components)
- **Examples**:
  - `src/app/page.tsx` - Landing page
  - `src/app/dashboard/page.tsx` - Dashboard page
  - `src/app/chat/page.tsx` - Chat interface
  - `src/components/` - React components

### Backend (Server-Side)
- **Location**: `src/app/api/` (route handlers)
- **Runs in**: Node.js server
- **Examples**:
  - `src/app/api/chat/messages/route.ts` - Chat API endpoint
  - `src/app/api/auth/[...nextauth]/route.ts` - Authentication
  - `src/app/api/users/route.ts` - User management API

### How They Work Together

```
┌─────────────────────────────────────┐
│         Next.js Server              │
│  (Single Process, Port 3000)        │
├─────────────────────────────────────┤
│  Frontend (React)                   │
│  • Pages (SSR/CSR)                  │
│  • Components                       │
│  • Browser JavaScript               │
├─────────────────────────────────────┤
│  Backend (Node.js)                  │
│  • API Routes (/api/*)              │
│  • Server Components                │
│  • Database (Prisma)                │
│  • Socket.io Server                 │
└─────────────────────────────────────┘
```

### Running the Application

**Development:**
```bash
pnpm dev
```
- Starts ONE server on http://localhost:3000
- Serves both frontend pages AND API routes
- Frontend requests `/api/chat/messages` → handled by backend route handler

**Production:**
```bash
pnpm build
pnpm start
```
- Builds the entire app (frontend + backend)
- Runs one Node.js process
- Handles everything

## Deployment Options

**⚠️ Important**: Accessly requires a **long-lived Node.js process** for Socket.io real-time features. Serverless platforms (Vercel, Netlify) are **not supported**.

### Recommended Platforms

**Option 1: Fly.io (Recommended)**
- Docker-based deployments with persistent connections
- Excellent WebSocket support
- Easy scaling: `fly scale count 3`
- Built-in Redis support
- See [docs/deploy.md](./docs/deploy.md) for detailed instructions

**Option 2: Render**
- Supports Docker and long-running processes
- Automatic SSL and health checks
- Redis add-on available
- Good for small to medium deployments

**Option 3: Railway**
- Docker-first platform
- One-click deployments from GitHub
- Built-in PostgreSQL and Redis
- Automatic deployments on push

**Option 4: Docker (Self-Hosting)**
- Full control over infrastructure
- One Docker container for Next.js app
- One Docker container for PostgreSQL (or use managed DB)
- Optional: Redis container for Socket.io scaling
- See `docker-compose.yml` for setup

### NOT Recommended

- **❌ Vercel**: Serverless functions don't support Socket.io long-lived connections
- **❌ Netlify**: Serverless-only, no persistent connections

## What Needs Separate Containers?

**NOT needed:**
- ❌ Separate frontend container (it's part of Next.js)
- ❌ Separate backend container (it's part of Next.js)

**OPTIONAL (but useful):**
- ✅ PostgreSQL database (could use Docker or managed service)
- ✅ Redis (for Socket.io scaling in production)

## Current Setup

Right now you have:
- **One application** (Next.js) that does everything
- **One command** (`pnpm dev`) starts it all
- **One port** (3000) serves everything

The "backend" and "frontend" are just different folders in the same codebase!
