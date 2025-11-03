# Accessly

Secure, role-based login → realtime chat → SSR dashboard data.

Built with Next.js 15, TypeScript, Tailwind CSS, NextAuth, Prisma, and Socket.io.

## Architecture

**Next.js is a full-stack framework** - it combines frontend and backend in one application:

- **Frontend**: `src/app/` (pages/components) - React components, runs in browser
- **Backend**: `src/app/api/` (route handlers) - API endpoints, runs on Node.js server
- **Single Process**: One Next.js server handles both (runs on port 3000)

See [ARCHITECTURE_EXPLAINED.md](./ARCHITECTURE_EXPLAINED.md) for details.

## Features

- **Authentication**: NextAuth with GitHub OAuth and Email providers
- **RBAC**: Role-based access control (USER, ADMIN)
- **Realtime Chat**: Socket.io-powered chat with presence indicators
- **SSR Dashboard**: Server-side rendered dashboard with role-based gating
- **Type Safety**: Full TypeScript with Zod validation
- **Testing**: Comprehensive test suite with Vitest

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth (Auth.js)
- **Realtime**: Socket.io
- **Validation**: Zod
- **Testing**: Vitest + Testing Library

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm (or npm/yarn)

### Install

```bash
pnpm i
```

### Environment Setup

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -hex 32`)
- `NEXTAUTH_URL` - Application URL (default: http://localhost:3000)

Optional (for authentication providers):
- `GITHUB_ID` and `GITHUB_SECRET` - GitHub OAuth
- `EMAIL_SERVER` and `EMAIL_FROM` - Email provider

Optional (for production):
- `REDIS_URL` - Redis adapter for Socket.io scaling

### Database Setup

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Seed database (creates admin user and sample rooms)
pnpm db:seed
```

### Development

```bash
pnpm dev
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

- **app**: Next.js application (port 3000)
- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis for Socket.io scaling (port 6379)

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

### Option 1: Vercel (Recommended)
- Connect your GitHub repo to Vercel
- Auto-detects Next.js
- Handles API routes automatically
- Free tier available

### Option 2: Docker (Self-Hosting)
- Use provided `Dockerfile` and `docker-compose.yml`
- Deploy to any Docker host (AWS ECS, DigitalOcean, etc.)

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
│   ├── api/          # Backend API route handlers
│   ├── (auth)/       # Auth routes (sign-in, error)
│   ├── dashboard/    # SSR dashboard
│   ├── admin/        # Admin panel
│   └── chat/         # Chat interface (frontend)
├── components/       # React components (frontend)
├── lib/              # Utilities (auth, validation, RBAC, etc.)
├── data/             # Seed scripts
├── tests/            # Test files
└── prisma/           # Prisma schema and migrations
```

## Realtime Communication

This project uses **Socket.io** for realtime chat and presence:

- Messages are broadcast to room members via Socket.io
- Presence tracking shows online users in each room
- For production scaling, use Redis adapter with `REDIS_URL`

## License

MIT