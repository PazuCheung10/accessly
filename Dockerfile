# Multi-stage Dockerfile for Accessly
FROM node:20-bullseye AS base

# Dependencies stage - install with frozen lockfile first
FROM base AS deps
WORKDIR /app

# Ensure same pnpm version that supports overrides
RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

# Copy only package files first for better layer caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

# Ensure same pnpm version in builder
RUN corepack enable && corepack prepare pnpm@8.15.1 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Print versions for verification
RUN node -e "const fs=require('fs');console.log('core:',JSON.parse(fs.readFileSync('node_modules/@auth/core/package.json')).version)"
RUN node -e "const fs=require('fs');console.log('next-auth:',JSON.parse(fs.readFileSync('node_modules/next-auth/package.json')).version)"
RUN node -e "const fs=require('fs');console.log('adapter:',JSON.parse(fs.readFileSync('node_modules/@auth/prisma-adapter/package.json')).version)"

# Tell Prisma to use glibc engine (not MUSL)
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=libquery_engine-linux-glibc.so.node

# Generate Prisma client in builder stage (before build, after source copy)
# This will generate the correct glibc binary for Debian/Render
RUN pnpm prisma:gen

# Verify Prisma Client generated correctly with Role enum
RUN node -e "const pc=require('@prisma/client'); console.log('Prisma types OK, Role:', Object.keys(pc).filter(k => k === 'Role').length > 0)"

# Run diagnostic checks BEFORE build
RUN node scripts/assert-single-core.mjs || (echo "✗ @auth/core version check failed" && exit 1)
RUN node scripts/assert-no-server-imports-in-client.mjs || (echo "✗ Client import check failed" && exit 1)
RUN node scripts/assert-ssg-safe.mjs || (echo "✗ SSG safety check failed" && exit 1)

# Force dedupe to ensure single @auth/core version
RUN pnpm dedupe --package @auth/core || true

# Build Next.js application
RUN pnpm build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/server ./server
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/tailwind.config.js ./
COPY --from=builder /app/postcss.config.js ./
COPY --from=builder /app/tsconfig.json ./
# Copy Prisma schema folder (needed for runtime)
COPY --from=builder /app/src/prisma ./src/prisma

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
