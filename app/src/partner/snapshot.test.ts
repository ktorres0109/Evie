import { describe, expect, it } from 'vitest'
import { computeCycleState } from '../engine/estimate'
import { addDays } from '../engine/cycle'
import { buildSnapshot } from './snapshot'
import { EMPTY_OWNER, type OwnerPartnerState } from './store'

const starts = ['2026-01-01', '2026-01-30', '2026-02-28', '2026-03-29']
const logs = starts.flatMap((s) => [0, 1, 2, 3].map((i) => ({ date: addDays(s, i), flow: 'medium' as const })))
const state = computeCycleState({ today: '2026-04-10', logs })
const partner: OwnerPartnerState = { ...EMPTY_OWNER, status: 'paired', ownerName: 'Jas', supportLines: ['Tea, not questions', ' '] }

describe('buildSnapshot', () => {
  it('contains only ticked scopes', () => {
    const snap = buildSnapshot({
      partner: { ...partner, scopes: { phase: false, range: false, support: false, symptoms: [] } },
      state,
      todayLog: { date: '2026-04-10', symptoms: ['Cramps'], notes: 'secret', intimacyEvents: ['protected'] },
      now: 'x',
    })
    expect(Object.keys(snap).sort()).toEqual(['issuedAt', 'ownerName', 'paused', 'v'])
  })

  it('softens the range by a day each side and never includes notes or intimacy', () => {
    const snap = buildSnapshot({
      partner: { ...partner, scopes: { phase: true, range: true, support: true, symptoms: ['Cramps'] } },
      state,
      todayLog: { date: '2026-04-10', symptoms: ['Cramps', 'Headache'], notes: 'secret', intimacyEvents: ['protected'] },
      now: 'x',
    })
    expect(snap.range!.start).toBe(addDays(state.window!.start, -1))
    expect(snap.range!.end).toBe(addDays(state.window!.end, 1))
    expect(snap.symptoms).toEqual(['Cramps'])
    expect(snap.support).toEqual(['Tea, not questions'])
    const text = JSON.stringify(snap)
    expect(text).not.toContain('secret')
    expect(text).not.toContain('protected')
    expect(text).not.toContain('Headache')
  })

  it('paused sends nothing but the paused flag', () => {
    const snap = buildSnapshot({ partner: { ...partner, paused: true }, state, todayLog: undefined, now: 'x' })
    expect(snap.paused).toBe(true)
    expect(snap.phase).toBeUndefined()
    expect(snap.range).toBeUndefined()
  })
})
