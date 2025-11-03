#!/usr/bin/env node
/**
 * Assert that server routes/pages that must not be pre-rendered are marked dynamic
 * Exits with code 1 if violations found
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Files that MUST be dynamic (not pre-rendered)
const MUST_BE_DYNAMIC = [
  'src/app/status/route.ts',
  'src/app/status/page.tsx',
  'src/app/dashboard/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/(auth)/sign-in/page.tsx', // Only if server component
]

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  
  // Skip client components (they can't be pre-rendered as SSR)
  if (content.includes("'use client'") || content.includes('"use client"')) {
    return null // Not applicable
  }
  
  // Check for required exports
  const hasRuntime = /export\s+(const|let|var)\s+runtime\s*=\s*['"]nodejs['"]/.test(content)
  const hasDynamic = /export\s+(const|let|var)\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(content)
  const hasRevalidate = /export\s+(const|let|var)\s+revalidate\s*=\s*0/.test(content)
  
  const isDynamic = hasDynamic || hasRevalidate
  
  return {
    hasRuntime,
    isDynamic,
    needsBoth: true, // We require both runtime AND dynamic
  }
}

let hasViolations = false

for (const pattern of MUST_BE_DYNAMIC) {
  const filePath = join(projectRoot, pattern)
  
  if (!require('fs').existsSync(filePath)) {
    continue // File doesn't exist, skip
  }
  
  const result = checkFile(filePath)
  
  if (result === null) {
    continue // Client component, skip
  }
  
  const { hasRuntime, isDynamic, needsBoth } = result
  
  if (needsBoth && (!hasRuntime || !isDynamic)) {
    hasViolations = true
    console.error(`✗ ${pattern}:`)
    if (!hasRuntime) {
      console.error('  Missing: export const runtime = "nodejs"')
    }
    if (!isDynamic) {
      console.error('  Missing: export const dynamic = "force-dynamic" OR export const revalidate = 0')
    }
  }
}

if (hasViolations) {
  console.error('\nFix: Add runtime and dynamic exports to prevent SSG')
  process.exit(1)
}

console.log('✓ All server routes/pages are marked as dynamic')
process.exit(0)

