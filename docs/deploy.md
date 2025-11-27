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

## Build Notes

**@auth/core Version Pinning**: We pin `@auth/core` to `0.41.1` via pnpm overrides to avoid mixed versions in serverless/container builds when `next-auth` and `@auth/prisma-adapter` require different versions. This prevents type conflicts during Docker builds.

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

### Render (Recommended for Demo/Production)

Render is an excellent choice for deploying Accessly as it supports long-lived Node.js processes and Docker deployments.

#### Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `accessly-db` (or your preferred name)
   - **Database**: `accessly` (or leave default)
   - **User**: `accessly` (or leave default)
   - **Region**: Choose closest to your users
   - **PostgreSQL Version**: 16 (recommended)
4. Click **"Create Database"**
5. **Important**: Copy the **Internal Database URL** (for use within Render) and **External Database URL** (for local access if needed)

#### Step 2: Create Redis Instance (Optional but Recommended)

For Socket.io horizontal scaling and better performance:

1. Click **"New +"** → **"Redis"**
2. Configure:
   - **Name**: `accessly-redis`
   - **Region**: Same as PostgreSQL
   - **Redis Version**: 7 (latest)
3. Click **"Create Redis"**
4. Copy the **Internal Redis URL** and **External Redis URL**

#### Step 3: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure the service:

   **Basic Settings:**
   - **Name**: `accessly` (or your preferred name)
   - **Region**: Same as database
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `/` (root of repo)
   - **Environment**: **Docker**
   - **Dockerfile Path**: `Dockerfile` (default)

   **Build & Deploy:**
   - **Build Command**: (leave empty - Docker handles this)
   - **Start Command**: `pnpm start`
   - **Health Check Path**: `/status`
   - **Health Check Interval**: 30 seconds

   **Advanced Settings:**
   - **Auto-Deploy**: Yes (deploy on git push)
   - **Docker Build Context**: `/` (root)
   - **Dockerfile Path**: `Dockerfile`

#### Step 4: Configure Environment Variables

In your Web Service settings, go to **"Environment"** and add:

**Required:**
```
DATABASE_URL=<Internal Database URL from Step 1>
AUTH_SECRET=<Generate with: openssl rand -hex 32>
NEXTAUTH_URL=https://your-app-name.onrender.com
NEXT_PUBLIC_APP_URL=https://your-app-name.onrender.com
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

**Optional (for Socket.io scaling):**
```
REDIS_URL=<Internal Redis URL from Step 2>
```

**Optional (for OAuth):**
```
GITHUB_ID=<Your GitHub OAuth App Client ID>
GITHUB_SECRET=<Your GitHub OAuth App Client Secret>
```

**Optional (for email auth):**
```
EMAIL_SERVER=smtp://user:pass@smtp.example.com:587
EMAIL_FROM=noreply@yourdomain.com
```

#### Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Build the Docker image
   - Deploy the service
   - Start the application

#### Step 6: Run Database Migrations

After the first deployment, run migrations:

**Option A: Using Render Shell (Recommended)**
1. Go to your Web Service
2. Click **"Shell"** tab
3. Run:
   ```bash
   pnpm prisma:deploy
   ```

**Option B: Using Render CLI**
```bash
# Install Render CLI
npm install -g render-cli

# Login
render login

# Run migrations
render run pnpm prisma:deploy
```

#### Step 7: Seed Demo Data (Optional)

If you want to seed demo data for testing:

1. Go to **"Shell"** tab in your Web Service
2. Run:
   ```bash
   pnpm db:seed-demo
   ```

This will create demo users, rooms, and messages. Demo accounts:
- `admin@solace.com` / `demo123`
- `clara@solace.com` / `demo123`
- `jacob@solace.com` / `demo123`
- `may@solace.com` / `demo123`
- `ethan@solace.com` / `demo123`

#### Step 8: Scale (Optional)

For production with multiple instances:

1. Go to your Web Service settings
2. Under **"Scaling"**, increase **"Instance Count"** to 2 or more
3. **Important**: You must have `REDIS_URL` configured for Socket.io to work across instances
4. Render will automatically load balance between instances

#### Render-Specific Notes

**Socket.io Adapter:**
- If `REDIS_URL` is set, Socket.io automatically uses the Redis adapter
- This enables real-time features to work across multiple instances
- Without Redis, Socket.io only works on a single instance

**Health Checks:**
- Render uses the `/status` endpoint to monitor service health
- If health checks fail, Render will restart the service
- Check logs if health checks are failing

**Custom Domain:**
1. Go to your Web Service settings
2. Click **"Custom Domains"**
3. Add your domain and follow DNS instructions
4. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your custom domain

**Environment Variables:**
- Use **Internal URLs** for services within Render (PostgreSQL, Redis)
- Use **External URLs** only for local development or external access
- Internal URLs are faster and more secure (no public access)

**Free Tier Limitations:**
- Render free tier spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds (cold start)
- Upgrade to paid plan for always-on service

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
