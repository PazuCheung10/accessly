#!/usr/bin/env node
/**
 * Assert that exactly one version of @auth/core is installed
 * Exits with code 1 if multiple versions found
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

function findAuthCoreVersions() {
  const versions = new Map()
  
  // Find all @auth/core package.json files in node_modules
  const pattern = join(projectRoot, 'node_modules', '**', '@auth', 'core', 'package.json')
  const corePaths = globSync(pattern, { absolute: true })
  
  for (const pkgPath of corePaths) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const version = pkg.version
      if (!versions.has(version)) {
        versions.set(version, [])
      }
      versions.get(version).push(pkgPath)
    } catch (err) {
      console.error(`Error reading ${pkgPath}:`, err.message)
    }
  }
  
  return versions
}

// Check via require.resolve first
try {
  const resolvedPath = require.resolve('@auth/core/package.json', { paths: [projectRoot] })
  const pkg = JSON.parse(readFileSync(resolvedPath, 'utf-8'))
  console.log(`✓ Resolved @auth/core: ${pkg.version} at ${resolvedPath}`)
} catch (err) {
  console.error('✗ Could not resolve @auth/core:', err.message)
  process.exit(1)
}

// Scan for duplicates
const versions = findAuthCoreVersions()

if (versions.size === 0) {
  console.error('✗ No @auth/core found in node_modules')
  process.exit(1)
}

if (versions.size === 1) {
  const [version, paths] = [...versions.entries()][0]
  console.log(`✓ Single @auth/core version found: ${version}`)
  if (paths.length > 1) {
    console.log(`  (found in ${paths.length} locations, same version)`)
  }
  process.exit(0)
}

// Multiple versions found
console.error('✗ Multiple @auth/core versions found:')
for (const [version, paths] of versions.entries()) {
  console.error(`  ${version}:`)
  paths.forEach(path => {
    console.error(`    - ${path}`)
  })
}
console.error('\nFix: Add @auth/core as direct dependency and pnpm override')
process.exit(1)

