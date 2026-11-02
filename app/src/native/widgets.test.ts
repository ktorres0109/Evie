import { describe, expect, it } from 'vitest'
import { widgetSnapshotFor } from './widgets'

const base = { appName: 'Meztli', privateDetail: 'Tap to log today', headline: 'Day 14', detail: 'Next: Nov 16–20', now: new Date('2026-11-02T12:00:00Z') }

describe('widgetSnapshotFor', () => {
  it('is private by default', () => {
    expect(widgetSnapshotFor({ ...base, showCycle: false, locked: false })).toMatchObject({ headline: 'Meztli', detail: 'Tap to log today' })
  })
  it('stays private while the app lock is on, even if she opted in', () => {
    expect(widgetSnapshotFor({ ...base, showCycle: true, locked: true }).headline).toBe('Meztli')
  })
  it('lets the widget count the day forward', () => {
    const snap = widgetSnapshotFor({ ...base, showCycle: true, locked: false, counting: { template: 'Day {n}', cycleDay: 14, today: '2026-11-02' } })
    expect(snap).toMatchObject({ headlineTemplate: 'Day {n}', cycleDay: 14, anchorDate: '2026-11-02' })
    expect(widgetSnapshotFor({ ...base, showCycle: false, locked: false, counting: { template: 'Day {n}', cycleDay: 14, today: '2026-11-02' } }).headlineTemplate).toBeUndefined()
  })
  it('shows day and range when she opted in', () => {
    expect(widgetSnapshotFor({ ...base, showCycle: true, locked: false })).toMatchObject({ headline: 'Day 14', detail: 'Next: Nov 16–20' })
  })
})
