#!/usr/bin/env node
/**
 * Assert that client components don't import server-only code
 * Exits with code 1 if violations found
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

const SERVER_IMPORTS = [
  /from ['"]@\/lib\/prisma['"]/,
  /from ['"]@\/lib\/auth['"]/,
  /from ['"]next-auth\/next['"]/,
  /from ['"]@prisma\/client['"]/,
  /require\(['"]@\/lib\/prisma['"]\)/,
  /require\(['"]@\/lib\/auth['"]\)/,
  /import.*prisma.*from/,
  /import.*auth\(.*from/,
]

const SERVER_MODULES = [
  'fs',
  'crypto',
  'path',
  'os',
]

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  
  // Check if it's a client component
  if (!content.includes("'use client'") && !content.includes('"use client"')) {
    return [] // Not a client component, skip
  }
  
  const violations = []
  
  // Check for server imports
  for (const pattern of SERVER_IMPORTS) {
    if (pattern.test(content)) {
      const lines = content.split('\n')
      const lineNum = lines.findIndex(line => pattern.test(line)) + 1
      violations.push({
        line: lineNum,
        pattern: pattern.toString(),
      })
    }
  }
  
  // Check for server module imports
  for (const module of SERVER_MODULES) {
    const pattern = new RegExp(`from ['"]${module}['"]|require\\(['"]${module}['"]\\)`)
    if (pattern.test(content)) {
      const lines = content.split('\n')
      const lineNum = lines.findIndex(line => pattern.test(line)) + 1
      violations.push({
        line: lineNum,
        pattern: `server module: ${module}`,
      })
    }
  }
  
  return violations
}

// Find all client components
const clientFiles = globSync('src/app/**/*.{ts,tsx}', { 
  cwd: projectRoot,
  absolute: true,
})

let hasViolations = false

for (const file of clientFiles) {
  const violations = checkFile(file)
  if (violations.length > 0) {
    hasViolations = true
    console.error(`✗ ${file.replace(projectRoot + '/', '')}:`)
    violations.forEach(v => {
      console.error(`  Line ${v.line}: ${v.pattern}`)
    })
  }
}

if (hasViolations) {
  console.error('\nFix: Remove server-only imports from client components')
  console.error('Use server actions or API routes instead')
  process.exit(1)
}

console.log('✓ No server imports found in client components')
process.exit(0)

