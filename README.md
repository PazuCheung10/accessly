# Accessly

Enterprise-grade realtime collaboration & helpdesk platform
Built to demonstrate real-world SaaS architecture, not just UI polish.

⸻

For Recruiters & Hiring Managers

Accessly demonstrates my ability to design and build a production-style SaaS system end-to-end, with an emphasis on:
	•	Realtime systems (Socket.io, presence, typing)
	•	Role-based access control (RBAC)
	•	Stateful UX (message caching, scroll restoration)
	•	Observability & audit logging
	•	Full-stack architecture using Next.js (App Router)

This is not a toy app — it is intentionally designed to mirror internal enterprise tooling.

⸻

Product Context
	•	Accessly — codebase name
	•	SolaceDesk — demo product scenario

SolaceDesk is an internal helpdesk workspace for a single company where teams collaborate and manage internal issues and support tickets in one unified system.

The seed data reflects this scenario with realistic:
	•	team rooms
	•	issue threads
	•	message history
	•	user roles

⸻

Core Features

Realtime Collaboration
	•	Socket.io-powered chat
	•	Presence & typing indicators
	•	Threaded conversations (root + replies)
	•	Emoji reactions (Slack/Discord-style)

Issue & Ticket Management
	•	Admin-created issues
	•	Status tracking (OPEN / WAITING / RESOLVED)
	•	User assignment
	•	Issue-specific chat rooms
	•	Metrics (last responder, avg response time)

Enterprise UX Details
	•	Per-room message caching
	•	Scroll position memory (even across refresh)
	•	Incremental message loading
	•	Flash-free navigation
	•	Full-text search (PostgreSQL tsvector)

Admin & Operations
	•	Role-based access control (USER / ADMIN)
	•	Observability dashboard (live metrics)
	•	Audit log system (who did what, when)
	•	Rate limiting & health checks

⸻

Tech Stack
	•	Framework: Next.js (App Router)
	•	Language: TypeScript
	•	Auth: NextAuth (Auth.js v5)
	•	Database: PostgreSQL + Prisma
	•	Realtime: Socket.io (Redis adapter ready)
	•	State: Zustand (persisted)
	•	Search: PostgreSQL Full-Text Search
	•	Styling: Tailwind CSS
	•	Testing: Vitest
	•	Observability: Custom metrics + optional Sentry

⸻

One-Click Demo (Recommended)

Requires Docker Desktop

pnpm demo

The demo script automatically:
	•	Starts PostgreSQL & Redis
	•	Generates .env with secrets
	•	Runs migrations
	•	Seeds realistic demo data
	•	Starts the app at http://localhost:3000

Demo Accounts

Role	Email	Password
Admin	admin@solace.com	demo123
Admin	clara@solace.com	demo123
User	jacob@solace.com	demo123
User	may@solace.com	demo123
User	ethan@solace.com	demo123


⸻

Architecture Overview

Accessly uses Next.js as a full-stack framework:
	•	Frontend: React components (src/app)
	•	Backend: API routes (src/app/api)
	•	Realtime: Custom Node.js server + Socket.io
	•	Database: PostgreSQL via Prisma

Client → Next.js Server → Prisma → PostgreSQL
        ↘ Socket.io ↗

📐 Detailed system design:
→ See ARCHITECTURE.md

⸻

Why This Project Exists

Most portfolio apps stop at CRUD.

Accessly focuses on:
	•	state correctness
	•	real-time UX
	•	operational thinking
	•	enterprise patterns

This is the kind of system I enjoy building and maintaining.

⸻

Deployment Notes

⚠️ Requires a long-running Node.js process

Supported:
	•	Fly.io
	•	Render
	•	Railway
	•	AWS ECS / EC2
	•	DigitalOcean App Platform

Not supported:
	•	❌ Vercel
	•	❌ Netlify

⸻

Documentation
	•	Architecture deep dive: ARCHITECTURE.md
	•	Deployment guide: docs/DEPLOYMENT_SIMPLE.md
	•	Observability: HOW_TO_VIEW_OBSERVABILITY.md

⸻

License

MIT

⸻

Built By Pazu
🔗 https://pazu.dev
🔗 https://www.linkedin.com/in/PazuC
