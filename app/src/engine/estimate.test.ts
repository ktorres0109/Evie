import { describe, expect, it } from 'vitest'
import type { DailyLog, LifeEvent } from '../db/schema'
import type { RegimenRecord } from '../db/regimen'
import { addDays } from './cycle'
import { companionState, computeCycleState, periodStartsFromLogs, withdrawalBleedFor } from './estimate'

/** Logs `days` of medium flow starting on each date. */
function periods(starts: string[], days = 5): DailyLog[] {
  return starts.flatMap((s) =>
    Array.from({ length: days }, (_, i) => ({ date: addDays(s, i), flow: 'medium' as const })),
  )
}

function startsFrom(first: string, lengths: number[]): string[] {
  const out = [first]
  for (const l of lengths) out.push(addDays(out.at(-1)!, l))
  return out
}

const event = (e: Partial<LifeEvent> & Pick<LifeEvent, 'kind' | 'startDate'>): LifeEvent => ({
  id: `${e.kind}-${e.startDate}`,
  createdAt: '2026-01-01T00:00:00Z',
  ...e,
})

describe('periodStartsFromLogs', () => {
  it('never starts a period on spotting', () => {
    const logs: DailyLog[] = [
      { date: '2026-03-01', spotting: true },
      { date: '2026-03-03', flow: 'light' },
      { date: '2026-03-04', flow: 'medium' },
    ]
    expect(periodStartsFromLogs(logs)).toEqual(['2026-03-03'])
  })
})

describe('computeCycleState', () => {
  it('no history → no-history, no window', () => {
    const s = computeCycleState({ today: '2026-05-01', logs: [] })
    expect(s.status).toBe('no-history')
    expect(s.window).toBeNull()
    expect(s.cycleDay).toBeNull()
  })

  it('one period, no typical length → insufficient, no dates', () => {
    const s = computeCycleState({ today: '2026-05-10', logs: periods(['2026-05-01']) })
    expect(s.status).toBe('insufficient')
    expect(s.window).toBeNull()
    expect(s.cycleDay).toBe(10)
    expect(s.confidence).toBe(1)
  })

  it('one cycle gives at most a rough window spoken in weeks', () => {
    const s = computeCycleState({ today: '2026-05-10', logs: periods(['2026-04-03', '2026-05-01']) })
    expect(s.status).toBe('insufficient')
    expect(s.window).not.toBeNull()
    expect(s.displayInWeeks).toBe(true)
    expect(s.confidence).toBe(1)
  })

  it('four regular cycles → a window around the median, moderate confidence', () => {
    const starts = startsFrom('2026-01-01', [29, 31, 28, 29])
    const today = addDays(starts.at(-1)!, 13)
    const s = computeCycleState({ today, logs: periods(starts) })
    expect(s.status).toBe('ok')
    expect(s.medianLength).toBe(29)
    expect(s.used).toHaveLength(4)
    expect(s.cycleDay).toBe(14)
    expect(s.window!.start <= addDays(starts.at(-1)!, 29)).toBe(true)
    expect(s.window!.end >= addDays(starts.at(-1)!, 29)).toBe(true)
    expect(s.confidence).toBe(3)
    expect(s.displayInWeeks).toBe(false)
  })

  it('leaves out a far outlier with a reason, and keeps it out of the median', () => {
    const starts = startsFrom('2025-12-01', [52, 29, 28, 31, 29])
    const s = computeCycleState({ today: addDays(starts.at(-1)!, 5), logs: periods(starts) })
    expect(s.excluded).toHaveLength(1)
    expect(s.excluded[0].reason).toEqual({ code: 'outlier', length: 52 })
    expect(s.medianLength).toBe(29)
  })

  it('lists an implausible interval as excluded, not silently dropped', () => {
    const starts = startsFrom('2026-01-01', [10, 28, 29])
    const s = computeCycleState({ today: addDays(starts.at(-1)!, 3), logs: periods(starts, 3) })
    expect(s.excluded.map((e) => e.reason.code)).toContain('implausible-length')
  })

  it('a cycle tagged illness with excludeCycle is left out with that reason', () => {
    const starts = startsFrom('2026-01-01', [29, 35, 28, 29])
    const s = computeCycleState({
      today: addDays(starts.at(-1)!, 2),
      logs: periods(starts),
      lifeEvents: [event({ kind: 'illness', startDate: addDays(starts[1], 10), excludeCycle: true })],
    })
    expect(s.excluded.find((e) => e.reason.code === 'life-event')).toMatchObject({ length: 35 })
    expect(s.used.map((c) => c.length)).not.toContain(35)
  })

  it('withholds the estimate on a hormonal regimen', () => {
    const starts = startsFrom('2026-01-01', [29, 29, 29])
    const regimen: RegimenRecord = {
      id: 'implant',
      method: 'implant',
      startDate: '2026-03-20',
      createdAt: '',
      updatedAt: '',
    }
    const s = computeCycleState({ today: '2026-04-10', logs: periods(starts), regimens: [regimen] })
    expect(s.status).toBe('withheld')
    expect(s.withheld?.code).toBe('hormonal-method')
    expect(s.window).toBeNull()
    expect(s.fertility.state).toBe('suppressed')
  })

  it('copper IUD does not withhold', () => {
    const starts = startsFrom('2026-01-01', [29, 29, 29])
    const regimen: RegimenRecord = {
      id: 'iud',
      method: 'copper-iud',
      startDate: '2025-01-01',
      config: { kind: 'iud', hormonal: false },
      createdAt: '',
      updatedAt: '',
    }
    const s = computeCycleState({ today: addDays(starts.at(-1)!, 3), logs: periods(starts), regimens: [regimen] })
    expect(s.status).toBe('ok')
  })

  it('pregnancy withholds; postpartum keeps withholding for about six months after birth', () => {
    const logs = periods(startsFrom('2025-01-01', [29, 29, 29]))
    expect(
      computeCycleState({ today: '2025-05-01', logs, lifeEvents: [event({ kind: 'pregnancy', startDate: '2025-04-01' })] }).withheld?.code,
    ).toBe('pregnancy')
    const ended = event({ kind: 'pregnancy-ended', startDate: '2026-01-10', outcome: 'birth' })
    expect(computeCycleState({ today: '2026-04-01', logs, lifeEvents: [ended] }).withheld?.code).toBe('postpartum')
    expect(computeCycleState({ today: '2026-09-01', logs, lifeEvents: [ended] }).withheld).toBeNull()
  })

  it('a pregnancy ending without a birth does not withhold, but marks cycles as settling', () => {
    const ended = event({ kind: 'pregnancy-ended', startDate: '2026-02-01' })
    // Only one period since it ended: still settling.
    const starts = ['2025-11-01', '2025-11-30', '2026-02-20']
    const s = computeCycleState({ today: '2026-03-01', logs: periods(starts), lifeEvents: [ended] })
    expect(s.withheld).toBeNull()
    expect(s.widenedBy).toContain('settling-after-pregnancy')
  })

  it('emergency contraception this cycle widens the range and makes fertility unknown', () => {
    const starts = startsFrom('2026-01-01', [28, 28, 28, 28, 28, 28])
    const last = starts.at(-1)!
    const base = computeCycleState({ today: addDays(last, 5), logs: periods(starts) })
    const withEc = computeCycleState({
      today: addDays(last, 5),
      logs: periods(starts),
      lifeEvents: [event({ kind: 'emergency-contraception', startDate: addDays(last, 3) })],
    })
    expect(withEc.spreadDays!).toBeGreaterThan(base.spreadDays!)
    expect(withEc.confidence).toBeLessThan(base.confidence)
    expect(withEc.fertility.state).toBe('unknown')
  })

  it('late: past the window end says how many days', () => {
    const starts = startsFrom('2026-01-01', [28, 28, 28, 28])
    const s = computeCycleState({ today: addDays(starts.at(-1)!, 40), logs: periods(starts) })
    expect(s.phase).toBe('late')
    expect(s.daysLate).toBeGreaterThan(0)
  })

  it('stale history stops counting cycle days', () => {
    const s = computeCycleState({ today: '2026-09-01', logs: periods(['2026-01-01', '2026-01-29']) })
    expect(s.status).toBe('stale')
    expect(s.cycleDay).toBeNull()
  })

  it('reports period day while bleeding', () => {
    const starts = startsFrom('2026-01-01', [28, 28, 28])
    const s = computeCycleState({ today: addDays(starts.at(-1)!, 1), logs: periods(starts) })
    expect(s.phase).toBe('period')
    expect(s.periodDay).toBe(2)
  })

  it('fertility: unknown with few cycles, three-state otherwise', () => {
    const few = computeCycleState({ today: '2026-03-10', logs: periods(startsFrom('2026-01-01', [28, 28])) })
    expect(few.fertility.state).toBe('unknown')
    expect(few.fertility.unknownReasons).toContain('few-cycles')

    const starts = startsFrom('2026-01-01', [28, 28, 28, 28, 28, 28])
    const last = starts.at(-1)!
    expect(computeCycleState({ today: addDays(last, 13), logs: periods(starts) }).fertility.state).toBe('potential')
    expect(computeCycleState({ today: addDays(last, 22), logs: periods(starts) }).fertility.state).toBe('lower')
  })

  it('a recent positive OPK always reads as potential', () => {
    const starts = startsFrom('2026-01-01', [28, 28, 28, 28, 28, 28])
    const last = starts.at(-1)!
    const logs = [...periods(starts), { date: addDays(last, 21), opk: 'positive' as const }]
    expect(computeCycleState({ today: addDays(last, 22), logs }).fertility.state).toBe('potential')
  })
})

describe('withdrawalBleedFor', () => {
  it('finds the placebo week of a 21/7 pack', () => {
    const regimen: RegimenRecord = {
      id: 'pill',
      method: 'combined-pill-patch-ring',
      startDate: '2026-03-01',
      config: { kind: 'pill', activePillsPerPack: 21, placeboPillsPerPack: 7, schedule: 'standard', currentPackStart: '2026-03-01' },
      createdAt: '',
      updatedAt: '',
    }
    const w = withdrawalBleedFor([regimen], '2026-03-10')!
    expect(w.freeInterval).toEqual({ start: '2026-03-22', end: '2026-03-28' })
    expect(w.daysUntil).toBe(12)
    // In the second pack it rolls forward.
    expect(withdrawalBleedFor([regimen], '2026-04-01')!.freeInterval.start).toBe('2026-04-19')
  })

  it('continuous pill has no planned bleed', () => {
    const regimen: RegimenRecord = {
      id: 'pill',
      method: 'combined-pill-patch-ring',
      startDate: '2026-03-01',
      config: { kind: 'pill', activePillsPerPack: 28, placeboPillsPerPack: 0, schedule: 'continuous', currentPackStart: '2026-03-01' },
      createdAt: '',
      updatedAt: '',
    }
    expect(withdrawalBleedFor([regimen], '2026-03-10')).toBeNull()
  })
})

describe('companionState', () => {
  it('grows at 5/15/35/70/120 and never shrinks; rests after 7 days away', () => {
    const dates = Array.from({ length: 16 }, (_, i) => addDays('2026-01-01', i))
    const s = companionState(dates, '2026-01-16', null)
    expect(s.stage).toBe(2)
    expect(s.resting).toBe(false)
    const later = companionState(dates, '2026-02-20', null)
    expect(later.stage).toBe(2)
    expect(later.resting).toBe(true)
  })
})
