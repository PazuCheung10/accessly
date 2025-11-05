# Accessly

Secure, role-based authentication → realtime chat → SSR dashboard with room management.

Built with Next.js 15, TypeScript, Tailwind CSS, NextAuth, Prisma, PostgreSQL, and Socket.io.

## Architecture

**Next.js is a full-stack framework** - it combines frontend and backend in one application:

- **Frontend**: `src/app/` (pages/components) - React components, runs in browser
- **Backend**: `src/app/api/` (route handlers) - API endpoints, runs on Node.js server
- **Server**: Custom Node.js HTTP server with Socket.io (runs on port 3000)
- **Single Process**: One Next.js server handles both (runs on port 3000)

See [ARCHITECTURE_EXPLAINED.md](./ARCHITECTURE_EXPLAINED.md) for details.

## Features

### Authentication & Authorization
- **Multi-Provider Auth**: NextAuth with GitHub OAuth, Email (magic link), and Credentials (email/password)
- **RBAC**: Role-based access control (USER, ADMIN)
- **Session Management**: JWT-based sessions with secure cookies
- **Protected Routes**: Server-side role verification

### Chat System
- **Realtime Chat**: Socket.io-powered chat with instant message delivery
- **Room Management**: 
  - Public rooms (anyone can join)
  - Private rooms (admin-assigned only)
  - Room creation (admin only)
  - Room joining (users can join public rooms)
- **Presence Indicators**: Shows who's online in each room
- **Message History**: Cursor-based pagination for efficient message loading
- **Rate Limiting**: Prevents message spam

### Dashboard & Admin
- **User Dashboard**: Personal stats (messages sent, rooms joined)
- **Admin Dashboard**: System-wide statistics (users, messages, rooms)
- **Admin Panel**: 
  - User management table
  - Room creation and management
  - System statistics
- **Role-Based UI**: Different views for USER vs ADMIN

### Technical Features
- **Type Safety**: Full TypeScript with Zod validation
- **Testing**: Comprehensive test suite with Vitest
- **Docker Support**: Multi-stage builds with docker-compose
- **Horizontal Scaling**: Redis adapter for Socket.io (optional)
- **Graceful Shutdown**: Proper cleanup of connections and resources

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth (Auth.js) v5
- **Realtime**: Socket.io with optional Redis adapter
- **Validation**: Zod
- **Testing**: Vitest + Testing Library
- **Password Hashing**: bcryptjs

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm (or npm/yarn)
- Docker & Docker Compose (optional, for containerized setup)

### Install

```bash
pnpm i
```

### Environment Setup

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

**Required environment variables:**
- `DATABASE_URL` - PostgreSQL connection string
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
```

**Default Accounts:**
- Admin: `admin@accessly.com` / `admin123`
- User: `user@accessly.com` / `user123`

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

```bash
# Start all services (PostgreSQL, Redis, Next.js app)
docker-compose up -d

# Run migrations
docker-compose exec app pnpm prisma migrate deploy

# Seed database
docker-compose exec app pnpm db:seed

# View logs
docker-compose logs -f app
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
- **Render**: Supports Docker and long-running processes
- **Railway**: Docker-first platform, great for Node.js apps
- **AWS ECS/EC2**: Self-hosted with Docker
- **DigitalOcean App Platform**: Supports Docker deployments

### NOT Recommended

- **❌ Vercel**: Serverless functions don't support Socket.io long-lived connections
- **❌ Netlify**: Serverless-only, no persistent connections

See [docs/deploy.md](./docs/deploy.md) for detailed deployment instructions.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API route handlers
│   │   ├── auth/          # NextAuth handlers
│   │   ├── chat/          # Chat API (messages, rooms)
│   │   └── status/        # Health check endpoint
│   ├── (auth)/            # Auth pages (sign-in, error)
│   ├── dashboard/         # User dashboard (SSR)
│   ├── admin/             # Admin panel (SSR, ADMIN only)
│   └── chat/              # Chat interface (client-side)
├── components/            # React components
│   ├── ChatRoom.tsx       # Chat room component
│   ├── CreateRoomForm.tsx # Room creation form (admin)
│   ├── Navbar.tsx         # Navigation bar
│   └── ...
├── lib/                   # Utilities
│   ├── auth.ts            # NextAuth configuration
│   ├── env.ts             # Environment validation
│   ├── prisma.ts          # Prisma client singleton
│   ├── rbac.ts            # Role-based access control
│   ├── socket.ts          # Socket.io client
│   └── validation.ts      # Zod schemas
├── data/                  # Seed scripts
├── tests/                 # Test files
├── prisma/                # Prisma schema and migrations
└── server/                # Custom Node.js server entry
    └── index.ts           # HTTP server + Socket.io setup
```

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get current session

### Chat
- `GET /api/chat/rooms` - List user's rooms
- `POST /api/chat/rooms` - Create room (admin only)
- `GET /api/chat/rooms/available` - List available public rooms
- `POST /api/chat/rooms/[roomId]/join` - Join a room
- `GET /api/chat/messages?roomId=...` - Get messages (paginated)
- `POST /api/chat/messages` - Send message

### System
- `GET /api/status` - Health check (DB, Redis status)

## Realtime Communication

This project uses **Socket.io** for realtime chat and presence:

- **Messages**: Broadcast to room members via Socket.io events
- **Presence**: Shows online users in each room
- **Scaling**: For production, use Redis adapter with `REDIS_URL` environment variable
- **Connection**: Socket.io available at `/socket.io` path

See [docs/scaling.md](./docs/scaling.md) for scaling strategies.

## Room System

### Public Rooms
- Visible to all users
- Users can join via "Join" button in chat sidebar
- Appears in "Available Rooms" list

### Private Rooms
- Only visible to members
- Requires admin assignment or invitation
- Not shown in available rooms list

### Room Roles
- **OWNER**: Created the room (admin)
- **MEMBER**: Regular member (can send messages)
- **MODERATOR**: (Future feature)

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
pnpm db:seed          # Seed database

# Testing
pnpm test             # Run tests
pnpm test:watch       # Watch mode
pnpm test:ui          # UI mode

# Checks
pnpm check:core       # Check @auth/core version
pnpm check:client-imports  # Check for server imports in client
pnpm check:ssg        # Check SSG safety
```

## License

MIT
