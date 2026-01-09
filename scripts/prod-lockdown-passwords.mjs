/**
 * Production password lockdown (Credentials provider only).
 *
 * Purpose:
 * - In production, invalidate ALL credentials passwords (bcrypt hashes) so nobody can
 *   sign in via email/password, while keeping demo observer accounts unchanged.
 *
 * Safety:
 * - Requires interactive confirmation.
 * - Refuses to run unless NODE_ENV=production.
 *
 * Notes:
 * - OAuth users (no password set) are unaffected.
 * - This script changes data in your production database. Treat carefully.
 */
import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const CONFIRM_PHRASE = 'LOCKDOWN_PROD_PASSWORDS'
const DEMO_EMAILS = new Set([
  // Current demo account email (standardized on solace.com)
  'demo@solace.com',
  // Legacy demo email (kept for safety in case old data exists)
  'demo@accessly.com',
])

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim()
}

async function main() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  if (nodeEnv !== 'production') {
    throw new Error(
      `Refusing to run: NODE_ENV must be 'production' (got '${nodeEnv}').`
    )
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.')
  }

  const rl = readline.createInterface({ input, output })
  try {
    output.write('\n⚠️  PRODUCTION PASSWORD LOCKDOWN\n')
    output.write('This will invalidate credentials passwords for ALL users except demo observers.\n')
    output.write('This cannot be undone without re-seeding or manually setting passwords.\n\n')
    output.write(`Type "${CONFIRM_PHRASE}" to proceed: `)
    const answer = await rl.question('')
    if (answer.trim() !== CONFIRM_PHRASE) {
      output.write('Aborted.\n')
      process.exitCode = 1
      return
    }
  } finally {
    rl.close()
  }

  const prisma = new PrismaClient()
  try {
    // Only users who can sign in via credentials have a password hash set.
    // We lock them down by rotating to a random password hash.
    const candidates = await prisma.user.findMany({
      where: { password: { not: null } },
      select: { id: true, email: true, role: true },
    })

    const toSkip = []
    const toLock = []
    for (const u of candidates) {
      const email = normalizeEmail(u.email)
      const isDemo =
        DEMO_EMAILS.has(email) || u.role === Role.DEMO_OBSERVER

      if (isDemo) toSkip.push(u)
      else toLock.push(u)
    }

    output.write(`\nFound ${candidates.length} users with credentials passwords.\n`)
    output.write(`- Will lock down: ${toLock.length}\n`)
    output.write(`- Will skip (demo): ${toSkip.length}\n\n`)

    // Rotate passwords one by one (unique random per user)
    let updated = 0
    for (const u of toLock) {
      const randomPassword = crypto.randomBytes(32).toString('hex')
      const hash = await bcrypt.hash(randomPassword, 12)
      await prisma.user.update({
        where: { id: u.id },
        data: { password: hash },
      })
      updated++
    }

    output.write(`✅ Done. Locked down ${updated} users.\n`)
    if (toSkip.length) {
      output.write('Skipped demo users:\n')
      for (const u of toSkip) {
        output.write(`- ${u.email ?? '(no email)'} (${u.role})\n`)
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  // Keep the error readable in Render shell logs
  console.error(`\n❌ ${err?.message ?? String(err)}\n`)
  process.exit(1)
})

