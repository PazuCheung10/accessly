# Dependencies
FROM node:20-bullseye-slim AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Builder
FROM node:20-bullseye-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# CRITICAL: Force Prisma to generate glibc binary (not MUSL)
# Issue: Render deployment shows "success" but Safari shows blank page and Chrome shows 502
# Root cause: Prisma was generating MUSL binaries (from Alpine) but Render uses Debian/glibc
# Solution: Explicitly set Prisma to generate glibc binaries for Debian/Render compatibility
ENV PRISMA_CLI_QUERY_ENGINE_TYPE="libquery_engine-linux-glibc"
ENV PRISMAengines="debian-openssl-3.0.x"

# Generate Prisma client with glibc engine
RUN pnpm prisma generate --schema=src/prisma/schema.prisma

# Build Next.js standalone
RUN pnpm build

# Runner
FROM node:20-bullseye-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# CRITICAL: Next.js standalone server.js reads HOSTNAME (not HOST) and PORT
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system nodejs && adduser --system nextjs

# Copy full standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy source files needed for seeding/debugging in Render Shell
# These are needed for: pnpm db:seed-demo, scripts/check-db-users.js, etc.
COPY --from=builder /app/src/data ./src/data
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dev dependencies needed for seeding (tsx, prisma CLI)
# These are required for: pnpm db:seed-demo, npx prisma db seed
RUN corepack enable && corepack prepare pnpm@8.15.1 --activate && \
    pnpm install --frozen-lockfile --prod=false --ignore-scripts && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
