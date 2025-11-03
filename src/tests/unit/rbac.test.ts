import { describe, it, expect } from 'vitest'
import { hasRole, assertRole, InsufficientRoleError } from '@/lib/rbac'
import { Role } from '@prisma/client'
import type { Session } from 'next-auth'

describe('hasRole', () => {
  it('should return true for matching role', () => {
    const session: Session = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: Role.USER,
      },
      expires: new Date().toISOString(),
    }

    expect(hasRole(session, Role.USER)).toBe(true)
  })

  it('should return false for non-matching role', () => {
    const session: Session = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: Role.USER,
      },
      expires: new Date().toISOString(),
    }

    expect(hasRole(session, Role.ADMIN)).toBe(false)
  })

  it('should return true for ADMIN accessing any role', () => {
    const session: Session = {
      user: {
        id: '123',
        email: 'admin@example.com',
        name: 'Admin User',
        image: null,
        role: Role.ADMIN,
      },
      expires: new Date().toISOString(),
    }

    expect(hasRole(session, Role.USER)).toBe(true)
    expect(hasRole(session, Role.ADMIN)).toBe(true)
  })

  it('should return false for null session', () => {
    expect(hasRole(null, Role.USER)).toBe(false)
    expect(hasRole(null, Role.ADMIN)).toBe(false)
  })

  it('should return false for session without user', () => {
    const session = null as any
    expect(hasRole(session, Role.USER)).toBe(false)
  })

  it('should return false for session without role', () => {
    const session: Session = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: undefined as any,
      },
      expires: new Date().toISOString(),
    }

    expect(hasRole(session, Role.USER)).toBe(false)
  })
})

describe('assertRole', () => {
  it('should not throw for matching role', () => {
    const session: Session = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: Role.USER,
      },
      expires: new Date().toISOString(),
    }

    expect(() => assertRole(session, Role.USER)).not.toThrow()
  })

  it('should throw InsufficientRoleError for non-matching role', () => {
    const session: Session = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: Role.USER,
      },
      expires: new Date().toISOString(),
    }

    expect(() => assertRole(session, Role.ADMIN)).toThrow(InsufficientRoleError)
  })

  it('should not throw for ADMIN accessing any role', () => {
    const session: Session = {
      user: {
        id: '123',
        email: 'admin@example.com',
        name: 'Admin User',
        image: null,
        role: Role.ADMIN,
      },
      expires: new Date().toISOString(),
    }

    expect(() => assertRole(session, Role.USER)).not.toThrow()
    expect(() => assertRole(session, Role.ADMIN)).not.toThrow()
  })

  it('should throw for null session', () => {
    expect(() => assertRole(null, Role.USER)).toThrow(InsufficientRoleError)
  })

  it('should throw error with correct code and status', () => {
    const session: Session = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: Role.USER,
      },
      expires: new Date().toISOString(),
    }

    try {
      assertRole(session, Role.ADMIN)
      expect.fail('Should have thrown')
    } catch (error: any) {
      expect(error).toBeInstanceOf(InsufficientRoleError)
      expect(error.code).toBe('INSUFFICIENT_ROLE')
      expect(error.status).toBe(403)
    }
  })
})