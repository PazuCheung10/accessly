# Quick Start Guide

## Architecture Overview

**Accessly uses Next.js - a full-stack framework that combines frontend and backend:**

- **Frontend**: React components (pages, UI) → runs in browser
- **Backend**: API routes (`/api/*`) + Socket.io server → runs on Node.js
- **One Server**: Everything runs together on port 3000

There is NO separate backend/frontend - it's all one Next.js application!

## Running with Docker (Easiest)

### 1. Start all services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database (port 5432)
- Redis (port 6379) 
- Next.js app with Socket.io (port 3000)

### 2. Run database migrations

```bash
docker-compose exec app pnpm prisma migrate deploy
```

### 3. Seed the database (optional - creates admin user and rooms)

```bash
docker-compose exec app pnpm db:seed
```

### 4. Access the app

Open your browser: **http://localhost:3000**

## Running without Docker (Local Development)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` - Your PostgreSQL connection string
- `AUTH_SECRET` - Generate with `openssl rand -hex 32`
- Optional: GitHub OAuth or Email provider credentials

### 3. Set up database

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Seed database (optional)
pnpm db:seed
```

### 4. Run the app

**Option A: Next.js dev server (no Socket.io)**
```bash
pnpm dev
```

**Option B: Custom server with Socket.io**
```bash
pnpm dev:server
```

Visit: **http://localhost:3000**

## What You'll See

1. **Landing page** (`/`) - "Accessly" with links
2. **Sign in page** (`/sign-in`) - Authentication
3. **Dashboard** (`/dashboard`) - SSR page (requires auth)
4. **Chat** (`/chat`) - Realtime chat with Socket.io
5. **Admin** (`/admin`) - Admin panel (ADMIN role only)

## Frontend vs Backend in Next.js

### Frontend (Browser)
- `src/app/page.tsx` - Landing page
- `src/app/dashboard/page.tsx` - Dashboard page
- `src/app/chat/page.tsx` - Chat page
- `src/components/` - React components

### Backend (Node.js Server)
- `src/app/api/chat/messages/route.ts` - Chat API
- `src/app/api/users/route.ts` - Users API
- `src/app/api/auth/[...nextauth]/route.ts` - Auth API
- `server/index.ts` - Socket.io server

### They run together!
- When you visit `/chat`, the browser loads the React component
- When the component calls `/api/chat/messages`, it hits the API route
- Socket.io handles realtime updates
- **All from one server on port 3000**

## Checking Status

```bash
# Check if services are running
docker-compose ps

# View logs
docker-compose logs -f app

# Check health
curl http://localhost:3000/status
```

## Troubleshooting

### Database connection failed
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running (if not using Docker)
- For Docker: `docker-compose ps` to verify db service

### Socket.io not working
- Ensure you're using `pnpm dev:server` (not `pnpm dev`)
- Check Redis is running (if using multi-instance)
- Verify `/socket.io` path in client

### Auth not working
- Verify `AUTH_SECRET` is set in `.env`
- Check `NEXTAUTH_URL` matches your app URL
- Ensure at least one provider is configured (GitHub or Email)
