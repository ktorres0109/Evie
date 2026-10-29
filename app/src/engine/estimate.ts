/**
 * The one estimate every screen reads.
 *
 * computeCycleState() turns raw local records (daily logs, birth-control
 * regimens, dated life context, the profile) into everything the UI needs:
 * cycle day and phase, the next-period window, a 1–5 confidence, the cycles
 * that were used and the ones left out *with a reason*, the fertility status
 * and, on pill/patch/ring, the expected withdrawal bleed.
 *
 * Rules the spec makes non-negotiable, enforced here rather than in views:
 *  - Never a single date: the result is always a window, or nothing.
 *  - Exclusions are explicit rows with reasons, never silently dropped.
 *  - Fewer than two usable cycles never produces dates; at most a rough
 *    "about N weeks" with confidence 1.
 *  - Fertility has three states plus suppression. "Unknown" is first-class.
 *
 * Pure and synchronous: no Dexie, no Date.now(). `today` is an input.
 */
import type { ContraceptionMethod, DailyLog, HealthProfile, LifeEvent, LifeEventKind } from '../db/schema'
import { activeRegimenOn, type RegimenRecord } from '../db/regimen'
import { addDays, daysBetween, detectBbtShiftEstimates, toEpochDay, type ISODate } from './cycle'

export type Confidence = 1 | 2 | 3 | 4 | 5

export type ExclusionReason =
  | { code: 'implausible-length'; length: number }
  | { code: 'outlier'; length: number }
  | { code: 'life-event'; kind: LifeEventKind }
  | { code: 'hormonal-method'; method: ContraceptionMethod }
  | { code: 'pregnancy' }

export interface CycleRecord {
  start: ISODate
  /** Last day of the cycle (the day before the next period started). */
  end: ISODate
  length: number
}

export interface ExcludedCycle extends CycleRecord {
  reason: ExclusionReason
}

export type WidenReason =
  | 'settling-after-hormonal'
  | 'settling-after-pregnancy'
  | 'emergency-contraception'
  | 'pcos'
  | 'endometriosis'
  | 'thyroid'
  | 'perimenopause'
  | 'weight-change'
  | 'intense-training'
  | 'irregular-reported'

export type WithholdReason =
  | { code: 'hormonal-method'; method: ContraceptionMethod; since: ISODate }
  | { code: 'pregnancy'; since: ISODate }
  | { code: 'postpartum'; since: ISODate }
  | { code: 'breastfeeding'; since: ISODate }
  | { code: 'testosterone'; since: ISODate }
  | { code: 'hysterectomy'; since: ISODate }
  | { code: 'menopause'; since: ISODate }

export type Phase =
  | 'period'
  | 'early'
  | 'mid'
  | 'later'
  | 'window'
  | 'late'
  | 'unknown'

export type EstimateStatus =
  /** No period has ever been logged. */
  | 'no-history'
  /** A period exists but there are fewer than two usable cycles. */
  | 'insufficient'
  /** A usable window exists. */
  | 'ok'
  /** Context (method, pregnancy, …) means no estimate is offered. */
  | 'withheld'
  /** The newest period start is too old to extrapolate from. */
  | 'stale'

export type FertilityState = 'potential' | 'unknown' | 'lower' | 'suppressed'

export type FertilityUnknownReason =
  | 'few-cycles'
  | 'wide-spread'
  | 'settling'
  | 'emergency-contraception'
  | 'no-estimate'
  | 'condition'

export interface FertilityStatus {
  state: FertilityState
  unknownReasons: FertilityUnknownReason[]
  /** Inputs, each labelled with its limit by the UI. */
  bbtReadingsThisCycle: number
  bbtShiftThisCycle: boolean
  lastOpk: { date: ISODate; result: 'positive' | 'negative' } | null
  /** Estimated window where pregnancy may be possible (calendar), when known. */
  potentialWindow: { start: ISODate; end: ISODate } | null
}

export interface WithdrawalBleed {
  method: 'pill' | 'patch' | 'ring'
  /** Hormone-free interval (placebo / patch-free / ring-free). */
  freeInterval: { start: ISODate; end: ISODate }
  /** When a withdrawal bleed usually shows up within that interval. */
  expected: { start: ISODate; end: ISODate }
  /** Days until the free interval starts (0 if inside it). */
  daysUntil: number
}

export interface PeriodLengthSummary {
  /** Typical bleeding length range from logged episodes, e.g. 4–6. */
  min: number
  max: number
  episodes: number
}

export interface CycleState {
  today: ISODate
  status: EstimateStatus
  withheld: WithholdReason | null
  /** Most recent logged period start on or before today. */
  lastPeriodStart: ISODate | null
  cycleDay: number | null
  /** When bleeding now: day N of this period. */
  periodDay: number | null
  phase: Phase
  /** "of about N": the median length, when known. */
  typicalLength: number | null
  window: { start: ISODate; end: ISODate } | null
  /** True when the window is wide enough that the UI should speak in weeks. */
  displayInWeeks: boolean
  daysUntilWindow: number | null
  /** Days past the end of the window, when late. */
  daysLate: number
  medianLength: number | null
  spreadDays: number | null
  confidence: Confidence
  used: CycleRecord[]
  excluded: ExcludedCycle[]
  widenedBy: WidenReason[]
  periodLength: PeriodLengthSummary | null
  fertility: FertilityStatus
  withdrawalBleed: WithdrawalBleed | null
  /** The active birth-control method today, if any. */
  method: ContraceptionMethod | null
}

export interface CycleInputs {
  today: ISODate
  logs: DailyLog[]
  regimens?: RegimenRecord[]
  lifeEvents?: LifeEvent[]
  profile?: Pick<HealthProfile, 'cycle' | 'reproductive' | 'conditions' | 'primaryGoal'>
}

// ---------------------------------------------------------------------------
// Tunables (kept together so the "How" text in the UI can quote them)
// ---------------------------------------------------------------------------

export const ESTIMATE_RULES = {
  minPlausible: 15,
  maxPlausible: 90,
  historyLimit: 6,
  staleDays: 90,
  /** A cycle further than this from the median is "far outside your usual range". */
  outlierMinDays: 8,
  outlierMadMultiplier: 3,
  minSpread: 2,
  maxSpread: 14,
  /** At or above this spread, ranges are spoken in weeks. */
  weeksThreshold: 7,
  settlingCycles: 3,
  postpartumDays: 183,
  /** Cycles after a pregnancy ends that widen the range. */
  settlingAfterPregnancyCycles: 2,
} as const

const HORMONAL = new Set<ContraceptionMethod>([
  'combined-pill-patch-ring',
  'progestin-only-pill',
  'injection',
  'implant',
  'hormonal-iud',
])

export function isHormonalMethod(method: ContraceptionMethod | null | undefined): boolean {
  return method != null && HORMONAL.has(method)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function covers(event: { startDate: string; endDate?: string }, date: ISODate): boolean {
  return date >= event.startDate && (!event.endDate || date <= event.endDate)
}

function overlaps(event: { startDate: string; endDate?: string }, start: ISODate, end: ISODate): boolean {
  const eventEnd = event.endDate ?? event.startDate
  return event.startDate <= end && eventEnd >= start
}

// ---------------------------------------------------------------------------
// Periods from logs
// ---------------------------------------------------------------------------

/** First day of each run of consecutive period-flow days. Spotting never counts. */
export function periodStartsFromLogs(logs: DailyLog[]): ISODate[] {
  const flowDates = logs
    .filter((log) => log.flow !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
  const starts: ISODate[] = []
  let prev = Number.NEGATIVE_INFINITY
  for (const log of flowDates) {
    const epoch = toEpochDay(log.date)
    if (log.periodStart || epoch - prev > 1) starts.push(log.date)
    prev = epoch
  }
  return [...new Set(starts)]
}

/** Consecutive period-flow runs, as [start, end]. */
export function bleedingEpisodes(logs: DailyLog[]): { start: ISODate; end: ISODate }[] {
  const dates = logs
    .filter((log) => log.flow !== undefined)
    .map((log) => log.date)
    .sort()
  const episodes: { start: ISODate; end: ISODate }[] = []
  for (const date of dates) {
    const last = episodes.at(-1)
    if (last && daysBetween(last.end, date) <= 1) last.end = date
    else episodes.push({ start: date, end: date })
  }
  return episodes
}

function periodLengthSummary(logs: DailyLog[], today: ISODate): PeriodLengthSummary | null {
  // Only finished episodes (not one still running today) and plausible ones.
  const lengths = bleedingEpisodes(logs)
    .filter((e) => daysBetween(e.end, today) >= 2)
    .map((e) => daysBetween(e.start, e.end) + 1)
    .filter((n) => n >= 2 && n <= 12)
    .slice(-6)
  if (lengths.length === 0) return null
  const sorted = [...lengths].sort((a, b) => a - b)
  // Middle of the distribution, so one unusual period does not stretch it.
  const lo = sorted[Math.floor((sorted.length - 1) * 0.2)]
  const hi = sorted[Math.ceil((sorted.length - 1) * 0.8)]
  return { min: lo, max: hi, episodes: lengths.length }
}

// ---------------------------------------------------------------------------
// Context: methods and life events
// ---------------------------------------------------------------------------

function methodOn(
  date: ISODate,
  regimens: RegimenRecord[],
  _profile: CycleInputs['profile'],
): { method: ContraceptionMethod; since: ISODate } | null {
  const active = activeRegimenOn(regimens, date)
  if (active) {
    // An IUD regimen stores hormonal vs copper in its config.
    if (active.config?.kind === 'iud') {
      return { method: active.config.hormonal ? 'hormonal-iud' : 'copper-iud', since: active.startDate }
    }
    return { method: active.method, since: active.startDate }
  }
  return null
}

function profileMethod(profile: CycleInputs['profile']): ContraceptionMethod | null {
  const m = profile?.reproductive.contraception
  return m && m !== 'none' && m !== 'unknown' && m !== 'prefer-not-to-say' ? m : null
}

const WITHHOLD_KINDS: LifeEventKind[] = [
  'pregnancy',
  'breastfeeding',
  'testosterone',
  'hysterectomy',
  'menopause',
]

function withholdReason(inputs: Required<Pick<CycleInputs, 'regimens' | 'lifeEvents'>> & CycleInputs): WithholdReason | null {
  const { today, regimens, lifeEvents, profile } = inputs
  const ongoing = (kind: LifeEventKind) =>
    lifeEvents
      .filter((e) => e.kind === kind && covers(e, today))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]

  const pregnancy = ongoing('pregnancy')
  if (pregnancy) return { code: 'pregnancy', since: pregnancy.startDate }
  if (profile?.primaryGoal === 'pregnancy') return { code: 'pregnancy', since: today }

  // Postpartum: an explicit postpartum entry, or a pregnancy that ended in birth.
  const birth = lifeEvents
    .filter((e) => (e.kind === 'postpartum' || (e.kind === 'pregnancy-ended' && e.outcome === 'birth')))
    .filter((e) => e.startDate <= today && daysBetween(e.startDate, today) < ESTIMATE_RULES.postpartumDays)
    .filter((e) => !e.endDate || e.endDate >= today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
  if (birth) return { code: 'postpartum', since: birth.startDate }

  for (const kind of WITHHOLD_KINDS.slice(1)) {
    const event = ongoing(kind)
    if (event) return { code: kind as Exclude<WithholdReason['code'], 'hormonal-method' | 'pregnancy' | 'postpartum'>, since: event.startDate }
  }

  const dated = methodOn(today, regimens, profile)
  const method = dated?.method ?? (regimens.length === 0 ? profileMethod(profile) : null)
  if (isHormonalMethod(method)) {
    return { code: 'hormonal-method', method: method!, since: dated?.since ?? today }
  }
  return null
}

// ---------------------------------------------------------------------------
// Cycles: used vs left out
// ---------------------------------------------------------------------------

function classifyCycles(
  starts: ISODate[],
  regimens: RegimenRecord[],
  lifeEvents: LifeEvent[],
): { used: CycleRecord[]; excluded: ExcludedCycle[] } {
  const all: CycleRecord[] = []
  for (let i = 0; i < starts.length - 1; i++) {
    const length = daysBetween(starts[i], starts[i + 1])
    all.push({ start: starts[i], end: addDays(starts[i + 1], -1), length })
  }

  const excluded: ExcludedCycle[] = []
  const candidates: CycleRecord[] = []
  for (const cycle of all) {
    if (cycle.length < ESTIMATE_RULES.minPlausible || cycle.length > ESTIMATE_RULES.maxPlausible) {
      excluded.push({ ...cycle, reason: { code: 'implausible-length', length: cycle.length } })
      continue
    }
    if (lifeEvents.some((e) => e.kind === 'pregnancy' && overlaps(e, cycle.start, cycle.end))) {
      excluded.push({ ...cycle, reason: { code: 'pregnancy' } })
      continue
    }
    const hormonal = regimens.find((r) => {
      const m = r.config?.kind === 'iud' ? (r.config.hormonal ? 'hormonal-iud' : 'copper-iud') : r.method
      return isHormonalMethod(m) && overlaps(r, cycle.start, cycle.end)
    })
    if (hormonal) {
      excluded.push({ ...cycle, reason: { code: 'hormonal-method', method: hormonal.method } })
      continue
    }
    const tagged = lifeEvents.find((e) => e.excludeCycle && overlaps(e, cycle.start, cycle.end))
    if (tagged) {
      excluded.push({ ...cycle, reason: { code: 'life-event', kind: tagged.kind } })
      continue
    }
    candidates.push(cycle)
  }

  // Relative outliers, judged against the person's own recent cycles. Needs at
  // least three to have a "usual" to be outside of.
  const recent = candidates.slice(-(ESTIMATE_RULES.historyLimit + 2))
  let used = recent
  if (recent.length >= 3) {
    const center = median(recent.map((c) => c.length))
    const mad = median(recent.map((c) => Math.abs(c.length - center)))
    const limit = Math.max(ESTIMATE_RULES.outlierMinDays, ESTIMATE_RULES.outlierMadMultiplier * 1.4826 * mad)
    used = []
    for (const cycle of recent) {
      if (Math.abs(cycle.length - center) > limit) {
        excluded.push({ ...cycle, reason: { code: 'outlier', length: cycle.length } })
      } else {
        used.push(cycle)
      }
    }
  }
  // Older usable cycles beyond the history window are simply not needed; they
  // are not "excluded" (nothing was judged), so they are not listed.
  used = used.slice(-ESTIMATE_RULES.historyLimit)
  excluded.sort((a, b) => b.start.localeCompare(a.start))
  return { used: [...used].reverse(), excluded }
}

function widenReasons(
  inputs: CycleInputs & { regimens: RegimenRecord[]; lifeEvents: LifeEvent[] },
  lastStart: ISODate | null,
  starts: ISODate[],
): WidenReason[] {
  const { today, regimens, lifeEvents, profile } = inputs
  const reasons = new Set<WidenReason>()
  const conditions = new Set<string>([...(profile?.conditions ?? [])])
  for (const e of lifeEvents) if (covers(e, today)) conditions.add(e.kind)

  if (conditions.has('pcos')) reasons.add('pcos')
  if (conditions.has('endometriosis')) reasons.add('endometriosis')
  if (conditions.has('thyroid') || conditions.has('thyroid-condition')) reasons.add('thyroid')
  if (conditions.has('perimenopause')) reasons.add('perimenopause')
  if (lifeEvents.some((e) => e.kind === 'weight-change' && covers(e, today))) reasons.add('weight-change')
  if (lifeEvents.some((e) => e.kind === 'intense-training' && covers(e, today))) reasons.add('intense-training')
  if (profile?.cycle.regularity === 'irregular') reasons.add('irregular-reported')

  const startsSince = (date: ISODate) => starts.filter((s) => s > date).length

  // Stopped a hormonal method recently: explicit entry or a closed regimen.
  const stoppedDates = [
    ...lifeEvents.filter((e) => e.kind === 'stopped-hormonal').map((e) => e.startDate),
    ...regimens
      .filter((r) => r.endDate && isHormonalMethod(r.method) && r.endDate <= today)
      .map((r) => r.endDate as string),
  ]
  if (stoppedDates.some((d) => startsSince(d) < ESTIMATE_RULES.settlingCycles)) {
    reasons.add('settling-after-hormonal')
  }

  const ended = lifeEvents.filter((e) => e.kind === 'pregnancy-ended' && e.startDate <= today)
  if (ended.some((e) => startsSince(e.startDate) < ESTIMATE_RULES.settlingAfterPregnancyCycles)) {
    reasons.add('settling-after-pregnancy')
  }

  // Emergency contraception taken in the current cycle can shift the next period.
  if (
    lifeEvents.some(
      (e) => e.kind === 'emergency-contraception' && (lastStart === null || e.startDate >= lastStart) && e.startDate <= today,
    )
  ) {
    reasons.add('emergency-contraception')
  }
  return [...reasons]
}

const WIDEN_DAYS: Record<WidenReason, number> = {
  'settling-after-hormonal': 4,
  'settling-after-pregnancy': 4,
  'emergency-contraception': 4,
  pcos: 5,
  endometriosis: 2,
  thyroid: 3,
  perimenopause: 6,
  'weight-change': 3,
  'intense-training': 3,
  'irregular-reported': 3,
}

function confidenceFor(used: number, spread: number, widened: WidenReason[]): Confidence {
  let score = used >= 6 ? 4 : used >= 4 ? 3 : used >= 3 ? 3 : used >= 2 ? 2 : 1
  if (used >= 6 && spread <= 3) score = 5
  if (spread >= 5) score -= 1
  if (spread >= ESTIMATE_RULES.weeksThreshold) score = 1
  if (widened.length) score -= 1
  return Math.max(1, Math.min(5, score)) as Confidence
}

// ---------------------------------------------------------------------------
// Birth control: withdrawal bleed
// ---------------------------------------------------------------------------

export function withdrawalBleedFor(regimens: RegimenRecord[], today: ISODate): WithdrawalBleed | null {
  const active = activeRegimenOn(regimens, today)
  const config = active?.config
  if (!config) return null

  let anchor: ISODate | undefined
  let active_: number
  let free: number
  let method: WithdrawalBleed['method']
  if (config.kind === 'pill') {
    if (config.schedule === 'continuous' || config.schedule === 'flexible') return null
    anchor = config.currentPackStart
    active_ = config.activePillsPerPack
    free = config.placeboPillsPerPack
    method = 'pill'
  } else if (config.kind === 'patch' || config.kind === 'ring') {
    anchor = config.kind === 'patch' ? config.currentPatchStart : config.currentRingStart
    active_ = config.cycle.wearDays
    free = config.cycle.ringFreeDays
    method = config.kind
  } else {
    return null
  }
  if (!anchor || free <= 0 || active_ <= 0) return null

  const length = active_ + free
  const elapsed = daysBetween(anchor, today)
  // Which pack/cycle are we in? Negative elapsed means the pack starts later.
  const index = elapsed < 0 ? 0 : Math.floor(elapsed / length)
  let freeStart = addDays(anchor, index * length + active_)
  let freeEnd = addDays(freeStart, free - 1)
  if (today > freeEnd) {
    freeStart = addDays(freeStart, length)
    freeEnd = addDays(freeStart, free - 1)
  }
  // A withdrawal bleed usually begins 1–3 days into the hormone-free days.
  const expectedStart = addDays(freeStart, Math.min(1, free - 1))
  const expectedEnd = addDays(freeStart, Math.min(free - 1, 4))
  return {
    method,
    freeInterval: { start: freeStart, end: freeEnd },
    expected: { start: expectedStart, end: expectedEnd },
    daysUntil: Math.max(0, daysBetween(today, freeStart)),
  }
}

// ---------------------------------------------------------------------------
// Fertility status
// ---------------------------------------------------------------------------

function fertilityStatus(args: {
  today: ISODate
  logs: DailyLog[]
  lastStart: ISODate | null
  window: { start: ISODate; end: ISODate } | null
  center: ISODate | null
  used: number
  spread: number | null
  withheld: WithholdReason | null
  widened: WidenReason[]
  stale: boolean
}): FertilityStatus {
  const { today, logs, lastStart } = args
  const inCycle = (d: ISODate) => (lastStart === null || d >= lastStart) && d <= today
  const cycleLogs = logs.filter((l) => inCycle(l.date))
  const bbt = cycleLogs.filter((l) => l.bbt !== undefined)
  const shifts = detectBbtShiftEstimates(bbt.map((l) => ({ date: l.date, bbt: l.bbt! })))
  const opks = cycleLogs.filter((l) => l.opk).sort((a, b) => b.date.localeCompare(a.date))
  const lastOpk = opks[0] ? { date: opks[0].date, result: opks[0].opk! } : null

  const base = {
    bbtReadingsThisCycle: bbt.length,
    bbtShiftThisCycle: shifts.length > 0,
    lastOpk,
  }

  if (args.withheld) return { state: 'suppressed', unknownReasons: [], potentialWindow: null, ...base }

  // Calendar estimate of where pregnancy may be possible: the five days before
  // the estimated ovulation range through one day after it.
  const potentialWindow =
    args.center === null
      ? null
      : { start: addDays(args.center, -16 - 5), end: addDays(args.center, -10 + 1) }

  const unknownReasons: FertilityUnknownReason[] = []
  if (args.stale || args.window === null) unknownReasons.push('no-estimate')
  if (args.used < 3) unknownReasons.push('few-cycles')
  if (args.spread !== null && args.spread > 5) unknownReasons.push('wide-spread')
  if (args.widened.includes('settling-after-hormonal') || args.widened.includes('settling-after-pregnancy')) {
    unknownReasons.push('settling')
  }
  if (args.widened.includes('emergency-contraception')) unknownReasons.push('emergency-contraception')
  if (args.widened.includes('pcos') || args.widened.includes('perimenopause')) unknownReasons.push('condition')

  // A recent positive OPK always means "may be possible", whatever else we know.
  const recentPositiveOpk = lastOpk?.result === 'positive' && daysBetween(lastOpk.date, today) <= 2
  if (recentPositiveOpk) return { state: 'potential', unknownReasons, potentialWindow, ...base }
  if (unknownReasons.length) return { state: 'unknown', unknownReasons, potentialWindow, ...base }

  const inWindow = potentialWindow !== null && today >= potentialWindow.start && today <= potentialWindow.end
  return { state: inWindow ? 'potential' : 'lower', unknownReasons, potentialWindow, ...base }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function computeCycleState(inputs: CycleInputs): CycleState {
  const regimens = inputs.regimens ?? []
  const lifeEvents = inputs.lifeEvents ?? []
  const { today, logs, profile } = inputs
  const full = { ...inputs, regimens, lifeEvents }

  const starts = periodStartsFromLogs(logs).filter((s) => s <= today)
  const lastPeriodStart = starts.at(-1) ?? null
  const withheld = withholdReason(full)
  const methodToday =
    methodOn(today, regimens, profile)?.method ?? (regimens.length === 0 ? profileMethod(profile) : null)
  const { used, excluded } = classifyCycles(starts, regimens, lifeEvents)
  const widenedBy = widenReasons(full, lastPeriodStart, starts)
  const periodLength = periodLengthSummary(logs, today)
  const withdrawalBleed = withdrawalBleedFor(regimens, today)

  const daysSinceStart = lastPeriodStart === null ? null : daysBetween(lastPeriodStart, today)
  const stale = daysSinceStart !== null && daysSinceStart > ESTIMATE_RULES.staleDays
  const cycleDay = lastPeriodStart !== null && !stale ? daysSinceStart! + 1 : null

  // Bleeding now: flow logged today or yesterday inside the latest episode.
  const episodes = bleedingEpisodes(logs.filter((l) => l.date <= today))
  const currentEpisode = episodes.at(-1)
  const bleedingNow =
    currentEpisode !== undefined && daysBetween(currentEpisode.end, today) <= 1 && daysBetween(currentEpisode.start, today) < 12
  const periodDay = bleedingNow ? daysBetween(currentEpisode!.start, today) + 1 : null

  const medianLength = used.length >= 2 ? median(used.map((c) => c.length)) : null
  const mad = medianLength === null ? null : median(used.map((c) => Math.abs(c.length - medianLength)))
  const widenDays = widenedBy.reduce((max, r) => Math.max(max, WIDEN_DAYS[r]), 0)

  let spreadDays: number | null = null
  if (medianLength !== null && mad !== null) {
    const base = Math.ceil(1.4826 * mad + 1)
    const fewBonus = used.length === 2 ? 2 : used.length === 3 ? 1 : 0
    spreadDays = Math.min(
      ESTIMATE_RULES.maxSpread,
      Math.max(ESTIMATE_RULES.minSpread, base + fewBonus) + widenDays,
    )
  }

  // A rough guess with one cycle or a stated typical length: weeks only, confidence 1.
  const roughLength =
    medianLength === null
      ? used.length === 1
        ? used[0].length
        : (profile?.cycle.typicalCycleLength ?? null)
      : null

  let status: EstimateStatus
  if (withheld) status = 'withheld'
  else if (lastPeriodStart === null) status = 'no-history'
  else if (stale) status = 'stale'
  else if (medianLength === null) status = 'insufficient'
  else status = 'ok'

  let window: CycleState['window'] = null
  let center: ISODate | null = null
  let spreadForWindow = spreadDays
  if (status === 'ok' && lastPeriodStart && medianLength !== null && spreadDays !== null) {
    center = addDays(lastPeriodStart, Math.round(medianLength))
  } else if (status === 'insufficient' && lastPeriodStart && roughLength !== null && roughLength >= 15 && roughLength <= 60) {
    center = addDays(lastPeriodStart, Math.round(roughLength))
    spreadForWindow = Math.max(ESTIMATE_RULES.weeksThreshold, widenDays + 5)
  }
  if (center !== null && spreadForWindow !== null) {
    window = { start: addDays(center, -spreadForWindow), end: addDays(center, spreadForWindow) }
  }

  // Phase, described by the body, never by the person.
  let phase: Phase = 'unknown'
  let daysLate = 0
  let daysUntilWindow: number | null = null
  if (bleedingNow) phase = 'period'
  else if (status === 'ok' && window && center) {
    if (today > window.end) {
      phase = 'late'
      daysLate = daysBetween(window.end, today)
    } else if (today >= window.start) phase = 'window'
    else {
      const ovStart = addDays(center, -16)
      const ovEnd = addDays(center, -10)
      phase = today < ovStart ? 'early' : today <= ovEnd ? 'mid' : 'later'
    }
  }
  if (window && today < window.start) daysUntilWindow = daysBetween(today, window.start)
  else if (window && today <= window.end) daysUntilWindow = 0

  const confidence: Confidence =
    status === 'ok' && spreadDays !== null ? confidenceFor(used.length, spreadDays, widenedBy) : 1

  return {
    today,
    status,
    withheld,
    lastPeriodStart,
    cycleDay,
    periodDay,
    phase,
    typicalLength: medianLength !== null ? Math.round(medianLength) : roughLength,
    window,
    displayInWeeks: window !== null && (status !== 'ok' || (spreadDays ?? 0) >= ESTIMATE_RULES.weeksThreshold),
    daysUntilWindow,
    daysLate,
    medianLength,
    spreadDays,
    confidence,
    used,
    excluded,
    widenedBy,
    periodLength,
    fertility: fertilityStatus({
      today,
      logs,
      lastStart: lastPeriodStart,
      window: status === 'ok' ? window : null,
      center: status === 'ok' ? center : null,
      used: used.length,
      spread: spreadDays,
      withheld,
      widened: widenedBy,
      stale,
    }),
    withdrawalBleed,
    method: methodToday,
  }
}

// ---------------------------------------------------------------------------
// Companion plant
// ---------------------------------------------------------------------------

export const PLANT_THRESHOLDS = [5, 15, 35, 70, 120] as const

export interface CompanionState {
  checkIns: number
  /** 0 = seed (not yet a seedling), 1–5 = stages. Never decreases. */
  stage: 0 | 1 | 2 | 3 | 4 | 5
  nextThreshold: number | null
  /** Resting after a gap of 7+ days: a UI state only, nothing is lost. */
  resting: boolean
  lastCheckIn: ISODate | null
  checkInsThisCycle: number
}

export function companionState(entryDates: ISODate[], today: ISODate, cycleStart: ISODate | null): CompanionState {
  const dates = [...new Set(entryDates)].filter((d) => d <= today).sort()
  const checkIns = dates.length
  let stage = 0
  for (const t of PLANT_THRESHOLDS) if (checkIns >= t) stage++
  const last = dates.at(-1) ?? null
  return {
    checkIns,
    stage: stage as CompanionState['stage'],
    nextThreshold: PLANT_THRESHOLDS.find((t) => t > checkIns) ?? null,
    resting: last !== null && daysBetween(last, today) >= 7,
    lastCheckIn: last,
    checkInsThisCycle: cycleStart ? dates.filter((d) => d >= cycleStart).length : checkIns,
  }
}
