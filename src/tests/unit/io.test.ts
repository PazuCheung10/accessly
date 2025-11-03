import { describe, it, expect } from 'vitest'
import { getIO } from '@/lib/io'

describe('io singleton', () => {
  it('should return undefined when not initialized', () => {
    // In test environment, io is not initialized
    const io = getIO()
    expect(io).toBeUndefined()
  })

  it('should export getIO function', () => {
    expect(typeof getIO).toBe('function')
  })
})
