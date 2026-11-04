import { describe, expect, it } from 'vitest'
import { exportable } from './transfer'
import { SK } from './schema'

const s = (key: string) => ({ key, value: 'x' })

describe('exportable settings', () => {
  it('keeps her preferences', () => {
    expect(exportable(s('prefs.v1'))).toBe(true)
    expect(exportable(s(SK.onboarded))).toBe(true)
  })
  it('never exports lock secrets, pairing keys, or this phone’s lock and setup state', () => {
    for (const k of [SK.pinHash, SK.pinSalt, 'partner.owner', 'dev-secret.x', 'lock.fails', 'lock.until', 'method.setupPending'])
      expect(exportable(s(k))).toBe(false)
  })
})
