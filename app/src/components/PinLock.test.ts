import { describe, expect, it } from 'vitest'
import { lockoutSeconds } from './PinLock'

describe('lockoutSeconds', () => {
  it('allows four free tries, then waits 30 s, doubling every five more, capped at 15 min', () => {
    expect([0, 4].map(lockoutSeconds)).toEqual([0, 0])
    expect([5, 9, 10, 15, 20].map(lockoutSeconds)).toEqual([30, 30, 60, 120, 240])
    expect(lockoutSeconds(100)).toBe(900)
  })
})
