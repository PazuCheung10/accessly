# Docker Build Issues Summary

## Current Problem

**Docker build fails** during `pnpm build` with TypeScript errors, preventing the application from being containerized.

## Error Messages

### 1. Type Error: @auth/core Version Mismatch
```
Type error: Type 'Adapter' from @auth/core@0.41.1 is not assignable to 
Type 'Adapter' from @auth/core@0.41.0

Property 'role' is missing in type 'AdapterUser' from 0.41.1 but required in 0.41.0
```
**Location**: `src/lib/auth.ts:41` - `adapter: PrismaAdapter(prisma)`

**Root Cause**: 
- `next-auth@5.0.0-beta.30` depends on `@auth/core@0.41.0`
- `@auth/prisma-adapter@2.11.1` depends on `@auth/core@0.41.1`
- Docker's pnpm install creates two separate `@auth/core` versions in node_modules
- TypeScript sees incompatible Adapter types

### 2. Build-Time Page Data Collection Failures
```
Build error occurred
[Error: Failed to collect page data for /status]
[Error: Failed to collect page data for /sign-in]
[Error: Failed to collect page data for /dashboard]
```
**Root Cause**:
- Next.js 15 tries to pre-render pages at build time
- These pages import server-only code (`auth()`, `prisma`, `env`) 
- Build environment doesn't have database/env, so it fails

### 3. Experimental Feature Error (Resolved)
```
Error: The experimental feature "experimental.cacheComponents" can only be enabled 
when using the latest canary version of Next.js.
```
**Status**: Fixed by removing `experimental.dynamicIO` from `next.config.js`

## What I've Tried

### ✅ Completed
1. **Added pnpm override** for `@auth/core: 0.41.1` in `package.json`
2. **Fixed type augmentation** - Only augmenting `next-auth` Session/User, not `@auth/core` AdapterUser
3. **Made status route dynamic** - Added `runtime: 'nodejs'` and `dynamic: 'force-dynamic'`
4. **Converted sign-in page to client component** - Changed from server component to `'use client'` using `next-auth/react`
5. **Removed experimental config** - Removed `experimental.dynamicIO` from `next.config.js`
6. **Fixed Dockerfile ordering** - Install dependencies before copying source, `prisma generate` before build
7. **Added type assertion** - `PrismaAdapter(prisma) as any` as temporary workaround

### ❌ Still Failing
- **Docker build still fails** with the `@auth/core` version mismatch
- The pnpm override may not be working correctly in Docker
- The `as any` type assertion is a workaround, not a fix

## Why It's Not Working

1. **pnpm override may not be respected in Docker build**
   - The override is in `package.json` but Docker's isolated build environment might not be using it correctly
   - Need to verify the override is actually applied during Docker build

2. **Next.js build process is complex**
   - Even with `dynamic = 'force-dynamic'`, Next.js still tries to analyze imports
   - The type checking happens before runtime, so TypeScript errors block the build

3. **Type system is strict**
   - The `as any` workaround suppresses the error, but if TypeScript still checks it during build, it might fail
   - Need to ensure the type error is truly bypassed

## Next Steps Needed

1. **Verify pnpm override works in Docker**
   - Check if `pnpm list @auth/core` shows single version in Docker build
   - Maybe need to use `.npmrc` or different override syntax

2. **Alternative: Type-safe workaround**
   - Instead of `as any`, create a wrapper that properly types the adapter
   - Or update both packages to compatible versions

3. **Alternative: Skip type checking during build**
   - Use `@ts-ignore` or `skipLibCheck: true` in tsconfig (not recommended)

4. **Best solution: Update package versions**
   - Find compatible versions of `next-auth` and `@auth/prisma-adapter` that use the same `@auth/core`
   - Or wait for package maintainers to align versions
