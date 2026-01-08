# Architecture Explained

Accessly is a **single full-stack Next.js application** (App Router) with a **custom Node.js server** to support Socket.io (long-lived WebSocket connections).

## High-level layout

- **UI + Routing**: `src/app/` (Next.js App Router)
- **API**: `src/app/api/` (route handlers)
- **Custom server**: `server/index.ts` (HTTP server + Socket.io)
- **DB access**: `src/lib/prisma.ts` (Prisma client)
- **Auth**: `src/lib/auth.ts` (NextAuth/Auth.js config)

## Runtime model (how it actually runs)

- **`pnpm dev`** runs the standard Next.js dev server (**no Socket.io**).
- **`pnpm dev:server`** runs `server/index.ts` (Next + Socket.io) and is the recommended way to develop realtime features.
- **`pnpm start`** also runs `server/index.ts` for production.

## Why a custom server?

Socket.io needs a persistent Node process to maintain connections, presence, and room membership state.

- Local/dev/prod server entry: `server/index.ts`
- This is why fully serverless platforms (like Vercel) aren’t a good fit for realtime Socket.io.

## Request / data flow

### Typical API flow

1. Browser calls an API route (e.g. `POST /api/chat/messages`)
2. Route handler validates input (Zod), checks auth/permissions, writes via Prisma
3. Server emits a Socket.io event to connected clients
4. Clients update local state and re-render

### Realtime flow (Socket.io)

- Clients connect to `/socket.io`
- Server emits events such as new messages, reactions, and presence changes
- Redis adapter can be enabled for horizontal scaling (via `REDIS_URL`)

## Security boundaries

- **Auth**: NextAuth session (server-verified) gates protected pages and API routes.
- **RBAC**: Role and membership checks happen **server-side** in route handlers (UI is a convenience, not security).

## State + performance strategy

The app is optimized for “Slack-like” usability:

- **Per-room caching**: message lists cached client-side (Zustand persist)
- **Incremental fetch**: load “since last seen” instead of refetching history
- **Scroll memory**: each room’s scroll position is preserved and restored
- **Thread deep-linking**: `?thread=...` opens specific threads deterministically

## Health checks

Two endpoints exist for different operational needs:

- **`GET /status`**: always returns 200 with a JSON body that includes an `ok` boolean and service hints (good for load balancers)
- **`GET /api/health`**: returns 200/503 based on DB/Redis connectivity (good for monitors)

## Observability

- **Telemetry dashboard**: `/admin/telemetry`
- **Audit log**: `/admin/audit`
- **Developer metrics**: `GET /api/dev/metrics` (dev mode or admin)
- Optional Sentry integration via `SENTRY_DSN`
