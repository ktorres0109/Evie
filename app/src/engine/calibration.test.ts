/**
 * Calibration: does the predicted window actually contain the next period?
 * Simulates people whose cycles vary the way real cycles do (each person has
 * their own typical length and their own variability, plus the occasional
 * far-off cycle) and measures how often the window holds the true next start.
 */
import { describe, expect, it } from 'vitest'
import type { DailyLog } from '../db/schema'
import { addDays, daysBetween } from './cycle'
import { computeCycleState } from './estimate'

// Small seeded PRNG so the numbers are the same on every run.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())

interface Result { n: number; hits: number; trials: number; width: number }

function simulate(historyCycles: number, people: number, seed: number): Result {
  const r = rng(seed)
  let hits = 0
  let width = 0
  let trials = 0
  for (let p = 0; p < people; p++) {
    const mean = 28 + normal(r) * 2.5
    const sd = 1.2 + r() * 3.3 // most people vary 1–4 days cycle to cycle
    const lengths = Array.from({ length: historyCycles + 1 }, () => {
      const far = r() < 0.05 ? 8 + r() * 15 : 0 // stress, illness…
      return Math.max(20, Math.round(mean + normal(r) * sd + far))
    })
    const starts = ['2026-01-01']
    for (const l of lengths) starts.push(addDays(starts.at(-1)!, l))
    const known = starts.slice(0, historyCycles + 1) // last known start + history
    const actualNext = starts[historyCycles + 1]
    const logs: DailyLog[] = known.flatMap((s) => [0, 1, 2, 3].map((i) => ({ date: addDays(s, i), flow: 'medium' as const })))
    const today = addDays(known.at(-1)!, 10)
    const st = computeCycleState({ today, logs })
    if (st.status !== 'ok' || !st.window) continue
    trials++
    width += daysBetween(st.window.start, st.window.end) + 1
    if (actualNext >= st.window.start && actualNext <= st.window.end) hits++
  }
  return { n: historyCycles, hits, trials, width: width / Math.max(trials, 1) }
}

describe('estimate calibration', () => {
  const rows = [2, 3, 4, 6].map((n) => simulate(n, 2000, 42 + n))

  it('holds the next period most of the time at every history length', () => {
    // Printed so a change to the rules shows its effect on accuracy.
    for (const r of rows) console.log(`cycles=${r.n} coverage=${((r.hits / r.trials) * 100).toFixed(1)}% width=${r.width.toFixed(1)}d trials=${r.trials}`)
    for (const r of rows) expect(r.hits / r.trials).toBeGreaterThan(0.8)
  })

  it('narrows as history grows', () => {
    expect(rows.at(-1)!.width).toBeLessThan(rows[0].width)
  })
})
