# Accessly

Secure, role-based login → realtime chat → SSR dashboard data.

Built with Next.js 15, TypeScript, Tailwind CSS, NextAuth, Prisma, and Socket.io.

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

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
│   ├── api/          # API route handlers
│   ├── (auth)/       # Auth routes (sign-in, error)
│   ├── dashboard/    # SSR dashboard
│   ├── admin/        # Admin panel
│   └── chat/         # Chat interface
├── components/       # React components
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