#!/usr/bin/env node
/**
 * Demo setup script - one-click demo mode
 * 
 * This script:
 * 1. Checks if Docker is available
 * 2. Starts docker-compose services (DB, Redis)
 * 3. Waits for services to be healthy
 * 4. Runs database migrations
 * 5. Seeds demo data
 * 6. Starts the application
 */

import { execSync, spawn } from 'child_process'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function checkCommand(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function checkDocker() {
  if (!checkCommand('docker')) {
    log('❌ Docker is not installed or not in PATH', colors.red)
    log('   Please install Docker Desktop: https://www.docker.com/products/docker-desktop', colors.yellow)
    process.exit(1)
  }

  try {
    execSync('docker info', { stdio: 'ignore' })
    return true
  } catch {
    log('❌ Docker daemon is not running', colors.red)
    log('   Please start Docker Desktop', colors.yellow)
    process.exit(1)
  }
}

function checkDockerCompose() {
  if (!checkCommand('docker-compose') && !checkCommand('docker')) {
    log('❌ docker-compose is not available', colors.red)
    process.exit(1)
  }
  
  // Try docker compose (v2) first, fallback to docker-compose (v1)
  try {
    execSync('docker compose version', { stdio: 'ignore' })
    return 'docker compose'
  } catch {
    return 'docker-compose'
  }
}

async function waitForService(service, maxAttempts = 30) {
  log(`⏳ Waiting for ${service} to be ready...`, colors.yellow)
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      if (service === 'postgres') {
        execSync(
          'docker exec accessly-db pg_isready -U accessly',
          { stdio: 'ignore' }
        )
        log(`✅ PostgreSQL is ready`, colors.green)
        return true
      } else if (service === 'redis') {
        execSync(
          'docker exec accessly-redis redis-cli ping',
          { stdio: 'ignore' }
        )
        log(`✅ Redis is ready`, colors.green)
        return true
      }
    } catch {
      // Service not ready yet
      process.stdout.write('.')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  log(`\n❌ ${service} did not become ready in time`, colors.red)
  return false
}

async function startDockerServices(dockerComposeCmd) {
  log('\n🐳 Starting Docker services...', colors.cyan)
  
  const composeFile = join(rootDir, 'docker-compose.yml')
  if (!existsSync(composeFile)) {
    log('❌ docker-compose.yml not found', colors.red)
    process.exit(1)
  }

  try {
    // Check if services are already running
    const psOutput = execSync(`${dockerComposeCmd} ps -q`, { 
      cwd: rootDir,
      encoding: 'utf-8' 
    })
    
    if (psOutput.trim()) {
      log('📦 Docker services are already running', colors.blue)
      return
    }
  } catch {
    // Services not running, continue
  }

  // Start services
  log('   Starting PostgreSQL and Redis...', colors.yellow)
  execSync(`${dockerComposeCmd} up -d db redis`, {
    cwd: rootDir,
    stdio: 'inherit',
  })

  // Wait for services to be healthy
  if (!waitForService('postgres')) {
    process.exit(1)
  }
  
  if (!waitForService('redis')) {
    process.exit(1)
  }
}

function runMigrations() {
  log('\n📊 Running database migrations...', colors.cyan)
  try {
    execSync('pnpm prisma migrate deploy --schema=src/prisma/schema.prisma', {
      cwd: rootDir,
      stdio: 'inherit',
    })
    log('✅ Migrations completed', colors.green)
  } catch (error) {
    log('❌ Migration failed', colors.red)
    process.exit(1)
  }
}

function generatePrismaClient() {
  log('\n🔧 Generating Prisma client...', colors.cyan)
  try {
    execSync('pnpm prisma:gen', {
      cwd: rootDir,
      stdio: 'inherit',
    })
    log('✅ Prisma client generated', colors.green)
  } catch (error) {
    log('❌ Prisma client generation failed', colors.red)
    process.exit(1)
  }
}

function seedDemoData() {
  log('\n🌱 Seeding demo data...', colors.cyan)
  try {
    execSync('pnpm db:seed-demo', {
      cwd: rootDir,
      stdio: 'inherit',
    })
    log('✅ Demo data seeded', colors.green)
  } catch (error) {
    log('❌ Seeding failed', colors.red)
    process.exit(1)
  }
}

function startApp() {
  log('\n🚀 Starting Accessly application...', colors.cyan)
  log('   The app will be available at http://localhost:3000', colors.blue)
  log('\n📋 Demo Accounts:', colors.bright)
  log('   Admin: admin@solace.com / demo123', colors.green)
  log('   Admin: clara@solace.com / demo123', colors.green)
  log('   User:  jacob@solace.com / demo123', colors.green)
  log('   User:  may@solace.com / demo123', colors.green)
  log('   User:  ethan@solace.com / demo123', colors.green)
  log('\n   Press Ctrl+C to stop the server\n', colors.yellow)
  
  // Start the app in the foreground
  const app = spawn('pnpm', ['start'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  })

  // Handle cleanup on exit
  process.on('SIGINT', () => {
    log('\n\n🛑 Shutting down...', colors.yellow)
    app.kill('SIGINT')
    process.exit(0)
  })

  app.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log(`\n❌ Application exited with code ${code}`, colors.red)
      process.exit(code)
    }
  })
}

function setupEnvFile() {
  const envPath = join(rootDir, '.env')
  const envExamplePath = join(rootDir, '.env.example')
  
  // If .env already exists, check if it has required vars
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8')
    const hasDatabaseUrl = envContent.includes('DATABASE_URL=')
    const hasAuthSecret = envContent.includes('AUTH_SECRET=')
    
    if (hasDatabaseUrl && hasAuthSecret) {
      log('✅ .env file already exists with required variables', colors.green)
      return
    }
    
    log('⚠️  .env file exists but missing some variables, updating...', colors.yellow)
  } else {
    log('\n📝 Creating .env file...', colors.cyan)
  }
  
  // Generate AUTH_SECRET if not present
  const authSecret = randomBytes(32).toString('hex')
  
  // Default DATABASE_URL for docker-compose
  const databaseUrl = 'postgresql://accessly:accessly_dev_password@localhost:5432/accessly'
  
  // Read existing .env or .env.example if it exists
  let envContent = ''
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf-8')
  } else if (existsSync(envExamplePath)) {
    envContent = readFileSync(envExamplePath, 'utf-8')
  }
  
  // Update or add required variables
  const lines = envContent.split('\n')
  const updatedLines = []
  let hasDatabaseUrl = false
  let hasAuthSecret = false
  let hasNextAuthUrl = false
  let hasNextPublicAppUrl = false
  
  for (const line of lines) {
    if (line.startsWith('DATABASE_URL=')) {
      updatedLines.push(`DATABASE_URL=${databaseUrl}`)
      hasDatabaseUrl = true
    } else if (line.startsWith('AUTH_SECRET=')) {
      updatedLines.push(`AUTH_SECRET=${authSecret}`)
      hasAuthSecret = true
    } else if (line.startsWith('NEXTAUTH_URL=')) {
      updatedLines.push('NEXTAUTH_URL=http://localhost:3000')
      hasNextAuthUrl = true
    } else if (line.startsWith('NEXT_PUBLIC_APP_URL=')) {
      updatedLines.push('NEXT_PUBLIC_APP_URL=http://localhost:3000')
      hasNextPublicAppUrl = true
    } else {
      updatedLines.push(line)
    }
  }
  
  // Add missing variables
  if (!hasDatabaseUrl) {
    updatedLines.push(`DATABASE_URL=${databaseUrl}`)
  }
  if (!hasAuthSecret) {
    updatedLines.push(`AUTH_SECRET=${authSecret}`)
  }
  if (!hasNextAuthUrl) {
    updatedLines.push('NEXTAUTH_URL=http://localhost:3000')
  }
  if (!hasNextPublicAppUrl) {
    updatedLines.push('NEXT_PUBLIC_APP_URL=http://localhost:3000')
  }
  
  // Write .env file
  writeFileSync(envPath, updatedLines.join('\n') + '\n', 'utf-8')
  log('✅ .env file created/updated with required variables', colors.green)
  log(`   DATABASE_URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`, colors.blue)
  log(`   AUTH_SECRET: ${authSecret.substring(0, 8)}... (auto-generated)`, colors.blue)
}

async function main() {
  log('\n🎭 Accessly Demo Mode Setup', colors.bright + colors.cyan)
  log('='.repeat(50), colors.cyan)

  // Check prerequisites
  log('\n🔍 Checking prerequisites...', colors.cyan)
  checkDocker()
  const dockerComposeCmd = checkDockerCompose()
  log('✅ All prerequisites met', colors.green)

  // Setup .env file
  setupEnvFile()

  // Start Docker services
  await startDockerServices(dockerComposeCmd)

  // Setup database
  runMigrations()
  generatePrismaClient()
  seedDemoData()

  // Start application
  startApp()
}

main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, colors.red)
  process.exit(1)
})

