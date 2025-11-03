# Deployment Guide

This guide covers deploying Accessly to various platforms. Accessly uses a custom Node.js server with Socket.io, so it requires a **long-lived Node server** (not serverless).

## Important: Not for Vercel Serverless

⚠️ **Do not deploy to Vercel's serverless functions**. Socket.io requires a persistent HTTP server, which Vercel serverless doesn't support.

Use platforms that support long-lived processes:
- Fly.io
- Render
- Railway
- AWS EC2 / ECS
- DigitalOcean App Platform
- Any Docker host

## Prerequisites

1. PostgreSQL database (managed or Docker)
2. Redis (optional, for horizontal scaling)
3. Environment variables configured

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret (`openssl rand -hex 32`)
- `NEXTAUTH_URL` - Your application URL
- `NEXT_PUBLIC_APP_URL` - Public application URL

Optional:
- `REDIS_URL` - Redis connection string (for Socket.io scaling)
- `GITHUB_ID` / `GITHUB_SECRET` - GitHub OAuth
- `EMAIL_SERVER` / `EMAIL_FROM` - Email provider
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)

## Deployment Platforms

### Fly.io

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Initialize Fly app**
   ```bash
   fly launch
   ```

3. **Set secrets**
   ```bash
   fly secrets set DATABASE_URL="postgresql://..."
   fly secrets set AUTH_SECRET="$(openssl rand -hex 32)"
   fly secrets set NEXTAUTH_URL="https://your-app.fly.dev"
   fly secrets set NEXT_PUBLIC_APP_URL="https://your-app.fly.dev"
   # Optional
   fly secrets set REDIS_URL="redis://..."
   fly secrets set GITHUB_ID="..."
   fly secrets set GITHUB_SECRET="..."
   ```

4. **Deploy**
   ```bash
   fly deploy
   ```

5. **Run migrations**
   ```bash
   fly ssh console -C "pnpm prisma:deploy"
   ```

6. **Scale**
   ```bash
   fly scale count 2  # Multiple instances (requires Redis)
   ```

### Render

1. **Create new Web Service**
   - Connect your GitHub repository
   - Select "Docker" as the environment

2. **Configure**
   - Build Command: `pnpm install && pnpm prisma generate && pnpm build`
   - Start Command: `pnpm start`
   - Health Check Path: `/status`

3. **Add Environment Variables**
   - Set all required env vars in Render dashboard

4. **Add PostgreSQL Service**
   - Create a new PostgreSQL database
   - Use the connection string for `DATABASE_URL`

5. **Deploy**
   - Render auto-deploys on git push

6. **Post-deploy migration**
   ```bash
   render run pnpm prisma:deploy
   ```

### Railway

1. **Create new project**
   - Connect GitHub repository

2. **Add services**
   - Add PostgreSQL database
   - Add Redis (optional)
   - Add Web Service (select Dockerfile)

3. **Configure environment**
   - Set all required environment variables
   - Railway auto-detects Dockerfile

4. **Deploy**
   - Railway auto-deploys on git push

5. **Run migrations**
   - Use Railway's CLI or one-click deploy

### AWS EC2 / ECS

1. **Build and push Docker image**
   ```bash
   docker build -t accessly:latest .
   docker tag accessly:latest your-registry/accessly:latest
   docker push your-registry/accessly:latest
   ```

2. **Deploy to ECS**
   - Create ECS task definition
   - Set environment variables
   - Deploy service

3. **For EC2**
   - SSH into instance
   - Pull Docker image
   - Run with docker-compose or docker run

4. **Set up RDS for PostgreSQL**
   - Create RDS PostgreSQL instance
   - Update `DATABASE_URL`

5. **Set up ElastiCache for Redis** (optional)
   - Create Redis cluster
   - Update `REDIS_URL`

## Health Checks

All platforms should use:
- **Health Check Path**: `/status`
- **Health Check Interval**: 30 seconds

The `/status` endpoint returns:
```json
{
  "ok": true,
  "timestamp": "2025-11-03T...",
  "db": "up",
  "redis": "up",
  "socketio": "up"
}
```

## Database Migrations

For production:
```bash
pnpm prisma:deploy
```

For one-time seeding (optional):
```bash
pnpm db:seed
```

## Horizontal Scaling

To run multiple app instances:

1. **Set up Redis**
   - Configure `REDIS_URL` environment variable
   - Socket.io will automatically use Redis adapter

2. **Scale instances**
   - Fly.io: `fly scale count 3`
   - Render: Scale slider in dashboard
   - Railway: Increase instance count
   - ECS: Update service desired count

3. **Load balancer**
   - No sticky sessions needed when using Redis adapter
   - Socket.io works across instances via Redis

## Troubleshooting

### Socket.io not working
- Ensure you're using the custom server (`pnpm start`), not `next start`
- Check that Socket.io server is initialized (check `/status` endpoint)
- Verify Redis adapter if using multiple instances

### Database connection issues
- Check `DATABASE_URL` is correct
- Ensure database is accessible from your deployment
- Verify network security groups/firewalls

### Health check failing
- Check `/status` endpoint manually
- Review application logs
- Verify all environment variables are set
