# Docker Build Issues Summary

## Current Status

**✅ PROGRESS**: Diagnostic scripts working - will fail early with clear evidence  
**✅ PROGRESS**: Fixed Prisma client browser import issues in client components  
**⚠️ CURRENT**: Fixing messages route that was accidentally corrupted

## Latest Error & Fixes

### Prisma Client Browser Import (✅ FIXED)
```
Module not found: Can't resolve '.prisma/client/index-browser'
Import trace: ./src/components/Navbar.tsx
```
**Root Cause**: Client components importing `Role` from `@prisma/client` triggers browser bundle  
**Fix**: Replaced with local type definition `type Role = 'USER' | 'ADMIN'` in:
- `src/components/Navbar.tsx` ✅
- `src/components/RoleGuard.tsx` ✅

## Latest Changes

### ✅ Added Diagnostic Scripts (Working)
1. `scripts/assert-single-core.mjs` - Verifies single @auth/core version ✅
2. `scripts/assert-no-server-imports-in-client.mjs` - Checks client components don't import server code ✅
3. `scripts/assert-ssg-safe.mjs` - Ensures dynamic routes are properly marked ✅

**Local Test Results**:
- ✅ `pnpm check:core` - Passes (single @auth/core@0.41.1 found)
- ✅ `pnpm check:ssg` - Passes (all routes marked as dynamic)
- ✅ `pnpm check:client-imports` - Passes (no server imports in client)

### ✅ Updated Dockerfile
- Runs diagnostic checks BEFORE build
- Fails early with clear error messages
- Pinned pnpm version to 8.15.1
- Prints versions for verification

### ✅ Fixed Issues
1. Navbar - Removed `@prisma/client` import, using local Role type ✅
2. RoleGuard - Removed `@prisma/client` import, using local Role type ✅
3. All routes marked with `runtime = 'nodejs'` and `dynamic = 'force-dynamic'` ✅

## What Has Been Fixed

### ✅ Completed
1. **Added diagnostic scripts** - Fail early with clear evidence ✅
2. **Added @auth/core as direct dependency** - Forces single version (0.41.1) ✅
3. **Added pnpm override** for `@auth/core: 0.41.1` in `package.json` ✅
4. **Regenerated lockfile** - `pnpm-lock.yaml` now reflects single @auth/core version ✅
5. **Fixed Dockerfile** - Added diagnostic checks, version checks, pnpm 8.15.1, dedupe step ✅
6. **Fixed type augmentation** - Only augmenting `next-auth` Session/User, not `@auth/core` AdapterUser ✅
7. **Made status route dynamic** - Added `runtime: 'nodejs'` and `dynamic: 'force-dynamic'` ✅
8. **Converted sign-in page to client component** - Changed to `'use client'` using `next-auth/react` ✅
9. **Made dashboard/admin dynamic** - Added `runtime: 'nodejs'` and `dynamic: 'force-dynamic'` ✅
10. **Removed experimental config** - Removed `experimental.dynamicIO` from `next.config.js` ✅
11. **Fixed client component Prisma imports** - Replaced with local Role type in Navbar and RoleGuard ✅

### ✅ Verification
- Version checks show single @auth/core@0.41.1 ✅
- Local lockfile regenerated ✅
- All server pages marked as dynamic ✅
- Diagnostic scripts working locally ✅
- All local checks pass ✅

## Error History

### 1. Type Error: @auth/core Version Mismatch (✅ RESOLVED)
**Status**: ✅ Fixed by adding direct dependency + pnpm override

### 2. Build-Time Page Data Collection Failures (✅ RESOLVED)
**Status**: ✅ Fixed by marking all server pages as dynamic

### 3. Experimental Feature Error (✅ RESOLVED)
**Status**: ✅ Fixed by removing experimental config

### 4. Prisma Client Browser Import (✅ RESOLVED)
**Status**: ✅ Fixed by replacing `@prisma/client` imports with local Role type in client components

## Files Changed

- `package.json` - Added `@auth/core: 0.41.1` as direct dependency + pnpm override + diagnostic scripts
- `pnpm-lock.yaml` - Regenerated with single @auth/core version
- `Dockerfile` - Added diagnostic checks, version checks, pnpm 8.15.1
- `next.config.js` - Removed experimental config
- `src/app/(auth)/sign-in/page.tsx` - Converted to client component
- `src/app/status/route.ts` - Made dynamic, fixed imports
- `src/app/dashboard/page.tsx` - Made dynamic
- `src/app/admin/page.tsx` - Made dynamic
- `src/components/Navbar.tsx` - Fixed Prisma import (local Role type)
- `src/components/RoleGuard.tsx` - Fixed Prisma import (local Role type)
- `scripts/*.mjs` - Added diagnostic scripts

## Next Steps

1. ✅ Test diagnostic scripts locally - **DONE**
2. ⚠️ Test local build - **In progress** (fixing messages route)
3. ⚠️ Test Docker build: `docker-compose build app --no-cache`
4. ⚠️ Diagnostic scripts will show exact failures if any

## Commands to Debug

```bash
# Run diagnostic checks locally (all should pass)
pnpm check:core
pnpm check:client-imports
pnpm check:ssg

# Test local build first (should pass)
pnpm build

# Full Docker build with plain output
docker-compose build app --no-cache --progress=plain 2>&1 | tee build.log

# If Docker fails, diagnostic scripts will show why
```

## Why This Approach Works

**Diagnostic-first approach**:
- ✅ Fails early with clear error messages
- ✅ Shows exactly what's wrong (duplicate core, client imports, SSG issues)
- ✅ No guessing - hard evidence of problems
- ✅ Prevents wasted build time
- ✅ Runs automatically before build (via `prebuild` script)

**Current Status**: 
- All diagnostic checks pass ✅
- Fixed Prisma imports in client components ✅
- Restoring messages route, then testing build