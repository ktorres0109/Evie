import { describe, expect, it } from 'vitest'
import type { RegimenRecord } from '../db/regimen'
import { DEFAULT_PREFS } from '../state/prefs'
import { methodReminderDates, planReminders } from './schedule'

const today = '2026-11-02'
const pill = (start: string, active = 21, placebo = 7): RegimenRecord => ({
  id: 'p',
  method: 'combined-pill-patch-ring',
  startDate: '2026-01-01',
  config: { kind: 'pill', activePillsPerPack: active, placeboPillsPerPack: placebo, schedule: 'standard', currentPackStart: start },
  createdAt: '',
  updatedAt: '',
})

describe('planReminders', () => {
  it('skips today’s check-in once she has logged today', () => {
    const prefs = { ...DEFAULT_PREFS, checkInReminderTime: '20:00' }
    const base = planReminders({ prefs, today, regimen: undefined, windowStart: null })
    const logged = planReminders({ prefs, today, regimen: undefined, windowStart: null, loggedToday: true })
    expect(base[0].date).toBe(today)
    expect(logged[0].date).toBe('2026-11-03')
    expect(logged).toHaveLength(base.length - 1)
  })

  it('sends nothing when the tone is off', () => {
    const prefs = { ...DEFAULT_PREFS, notificationTone: 'off' as const, checkInReminderTime: '20:00', methodReminderTime: '09:00' }
    expect(planReminders({ prefs, today, regimen: pill(today), windowStart: today })).toEqual([])
  })

  it('adds the window heads-up only for a future window', () => {
    const prefs = { ...DEFAULT_PREFS, windowReminder: true }
    expect(planReminders({ prefs, today, regimen: undefined, windowStart: '2026-11-10' })).toEqual([{ date: '2026-11-10', time: '09:00', kind: 'window' }])
    expect(planReminders({ prefs, today, regimen: undefined, windowStart: '2026-11-01' })).toEqual([])
  })
})

describe('methodReminderDates', () => {
  it('skips the pill-free week of a 21/7 pack', () => {
    const dates = methodReminderDates(pill('2026-10-13'), today, 14)
    // Pack day 21 is 2026-11-02 (day index 20); 11-03..11-09 are pill-free.
    expect(dates).toContain('2026-11-02')
    expect(dates).not.toContain('2026-11-05')
    expect(dates).toContain('2026-11-10')
  })

  it('reminds every day on a 24/4 pack, whose placebo pills are still taken', () => {
    expect(methodReminderDates(pill('2026-10-13', 24, 4), today, 14)).toHaveLength(14)
  })
})
