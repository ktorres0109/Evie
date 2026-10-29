/**
 * Builds the partner snapshot: the only thing that ever leaves the owner's
 * phone. It is assembled field by field from live consent (scopes); anything
 * not ticked is simply not in the object.
 */
import { addDays } from '../engine/cycle'
import type { CycleState } from '../engine/estimate'
import type { DailyLog } from '../db/schema'
import type { OwnerPartnerState, PartnerSnapshot } from './store'

/** Shown word-for-word on both phones (spec §5.7: byte-identical). */
export const NEVER_SHARED_KEYS = [
  'partner.never.notes',
  'partner.never.history',
  'partner.never.sex',
  'partner.never.tests',
  'partner.never.bbt',
  'partner.never.medical',
  'partner.never.pregnancy',
] as const

export function buildSnapshot(args: {
  partner: OwnerPartnerState
  state: CycleState
  todayLog: DailyLog | undefined
  now: string
}): PartnerSnapshot {
  const { partner, state } = args
  const base: PartnerSnapshot = { v: 1, issuedAt: args.now, ownerName: partner.ownerName, paused: partner.paused }
  if (partner.paused) return base

  const s = partner.scopes
  if (s.phase) {
    base.phase = state.withheld ? 'unknown' : state.phase
  }
  if (s.range) {
    if (state.withheld || state.status !== 'ok' || !state.window) {
      base.range = null
      base.rangeWithheld = Boolean(state.withheld)
    } else {
      // Softened: a day wider each side, so the partner never holds a date.
      base.range = { start: addDays(state.window.start, -1), end: addDays(state.window.end, 1) }
    }
  }
  if (s.support) base.support = partner.supportLines.map((l) => l.trim()).filter(Boolean).slice(0, 6)
  if (s.symptoms.length) {
    const today = new Set(args.todayLog?.symptoms ?? [])
    base.symptoms = s.symptoms.filter((x) => today.has(x))
  }
  return base
}

/** Stable comparison so unchanged snapshots are not re-uploaded. */
export function snapshotKey(snapshot: PartnerSnapshot): string {
  const { issuedAt: _ignored, ...rest } = snapshot
  void _ignored
  return JSON.stringify(rest)
}
