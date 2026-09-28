/*
 * Cycle prediction engine.
 *
 * Core logic ported from Mensinator (MIT, github.com/EmmaTellblom/Mensinator):
 * CalculationsHelper.kt, PeriodPrediction.kt, OvulationPrediction.kt —
 * translated from Kotlin+SQLite queries to pure functions over sorted arrays.
 * Kotlin quirks preserved on purpose (Long truncation of averages, Int
 * division flooring the luteal mean) so fixtures stay comparable upstream.
 *
 * Blocks marked EXTENSION go beyond the port: luteal fallback ovulation
 * estimate, fertile window, uncertainty band, and the 3-consecutive-cycle
 * baseline recalibration rule (docs/upstream-lunara/RESEARCH.md §5).
 */

export type ISODate = string // 'YYYY-MM-DD'

export interface EngineInput {
  /** First day of each period, ascending, deduped. */
  periodStarts: ISODate[]
  /** Ovulation-day estimates supported by retrospective signals such as BBT. */
  ovulations: ISODate[]
  today: ISODate
}

export interface EngineOptions {
  /** How many recent cycles feed the averages (Mensinator default: 5). */
  periodHistory?: number
  ovulationHistory?: number
  /** Use ovulation-anchored (luteal) prediction when ovulation data exists. */
  useLutealCalculation?: boolean
  /** EXTENSION: assumed luteal length when no ovulation data exists. */
  defaultLutealDays?: number
  /** User-entered baseline used only until two real period starts exist. */
  baselineCycleLength?: number
}

export interface Prediction {
  nextPeriodStart: ISODate | null
  ovulationDate: ISODate | null
  fertileWindow: { start: ISODate; end: ISODate } | null
  /** ± days around nextPeriodStart. */
  uncertaintyDays: number
  cycleDay: number | null
  averageCycleLength: number
  source: 'baseline' | 'basic' | 'luteal' | 'insufficient-data'
}

export interface TemperatureReading {
  date: ISODate
  /** Basal body temperature in °C ×100. */
  bbt: number
}

const MS_PER_DAY = 86_400_000

/**
 * Longest interval that may still be presented as "your current cycle".
 *
 * Beyond this the app has no idea whether a period was simply not logged, or
 * whether the cycle genuinely ran long, so counting onward produces figures
 * like "Cycle day 310". 90 days matches MAX_DATA_INTERVAL in cycleForecast: an
 * interval we would refuse to learn from must not be one we narrate either.
 */
export const MAX_PLAUSIBLE_CYCLE_DAY = 90

/**
 * A period start older than this makes every derived "current" figure — cycle
 * day, next-period estimate, fertile window — untrustworthy rather than merely
 * uncertain. The app degrades to an explicit "resume tracking" state instead of
 * extrapolating across the gap.
 */
export const STALE_HISTORY_DAYS = 90

/**
 * How long a period estimate stays meaningful after its upper uncertainty
 * bound passes. Inside this window the app can honestly say "your period is
 * N days later than estimated"; past it, the anchor has expired and the app
 * says it does not know rather than reporting a date that slid into the past.
 */
export const LATE_FORECAST_GRACE_DAYS = 21

export function toEpochDay(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, day) / MS_PER_DAY
}

export function fromEpochDay(n: number): ISODate {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10)
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromEpochDay(toEpochDay(d) + n)
}

/**
 * Detect a conservative biphasic BBT shift: three consecutive readings at
 * least 0.2 °C above the mean of the preceding 4–6 readings. A shift can
 * support an ovulation estimate retrospectively, but BBT alone does not
 * confirm that ovulation occurred. The returned date is the day before the
 * first high reading. Isolated spikes are deliberately ignored.
 */
export function detectBbtShiftEstimates(readings: TemperatureReading[]): ISODate[] {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date))
  const shifts: ISODate[] = []
  let lastShiftEpoch = Number.NEGATIVE_INFINITY

  for (let i = 4; i <= sorted.length - 3; i++) {
    const baseline = sorted.slice(Math.max(0, i - 6), i)
    const high = sorted.slice(i, i + 3)
    const baselineContiguous = baseline.every(
      (reading, j) => j === 0 || daysBetween(baseline[j - 1].date, reading.date) <= 2,
    )
    const contiguous = high.every(
      (reading, j) => j === 0 || daysBetween(high[j - 1].date, reading.date) <= 2,
    )
    if (!baselineContiguous || !contiguous) continue

    const baselineMean = baseline.reduce((sum, reading) => sum + reading.bbt, 0) / baseline.length
    if (!high.every((reading) => reading.bbt >= baselineMean + 20)) continue

    const ovulation = addDays(high[0].date, -1)
    const epoch = toEpochDay(ovulation)
    if (epoch - lastShiftEpoch >= 14) {
      shifts.push(ovulation)
      lastShiftEpoch = epoch
    }
  }

  return shifts
}

/**
 * @deprecated Use detectBbtShiftEstimates. Kept while older callers migrate;
 * the returned dates are estimates supported by a BBT shift, not confirmation.
 */
export const detectBbtOvulations = detectBbtShiftEstimates

export function daysBetween(a: ISODate, b: ISODate): number {
  return toEpochDay(b) - toEpochDay(a)
}

/** Mirrors getLatestXPeriodStart(x): the last x+1 start dates. */
function latestPeriodStarts(periodStarts: ISODate[], x: number): ISODate[] {
  return periodStarts.slice(-(x + 1))
}

function average(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function consecutiveDiffs(dates: ISODate[]): number[] {
  const out: number[] = []
  for (let i = 0; i < dates.length - 1; i++) out.push(daysBetween(dates[i], dates[i + 1]))
  return out
}

export function averageCycleLength(periodStarts: ISODate[], periodHistory = 5): number {
  const dates = latestPeriodStarts(periodStarts, periodHistory)
  if (dates.length < 2) return 0
  return average(consecutiveDiffs(dates))
}

/** Days from the previous period start to each ovulation, averaged (2 dp). */
export function averageFollicularGrowthInDays(
  periodStarts: ISODate[],
  ovulations: ISODate[],
  ovulationHistory = 5,
): number {
  const dates = ovulations.slice(-ovulationHistory)
  if (dates.length === 0) return 0
  const growth: number[] = []
  for (const d of dates) {
    const prevStart = firstPreviousPeriodDate(periodStarts, d)
    if (prevStart !== null) growth.push(daysBetween(prevStart, d))
  }
  if (growth.length === 0) return 0
  return Math.round(average(growth) * 100) / 100
}

/** Last period start on or before `date` (getFirstPreviousPeriodDate). */
export function firstPreviousPeriodDate(periodStarts: ISODate[], date: ISODate): ISODate | null {
  let found: ISODate | null = null
  for (const p of periodStarts) {
    if (toEpochDay(p) <= toEpochDay(date)) found = p
    else break
  }
  return found
}

/** First period start strictly after `date` (getFirstNextPeriodDate). */
export function firstNextPeriodDate(periodStarts: ISODate[], date: ISODate): ISODate | null {
  for (const p of periodStarts) {
    if (toEpochDay(p) > toEpochDay(date)) return p
  }
  return null
}

/** Ovulations that are followed by a logged period (getLatestXOvulationsWithPeriod). */
function ovulationsWithPeriod(periodStarts: ISODate[], ovulations: ISODate[], x: number): ISODate[] {
  return ovulations.filter((o) => firstNextPeriodDate(periodStarts, o) !== null).slice(-x)
}

export function averageLutealLength(
  periodStarts: ISODate[],
  ovulations: ISODate[],
  ovulationHistory = 5,
): number {
  const dates = ovulationsWithPeriod(periodStarts, ovulations, ovulationHistory)
  if (dates.length === 0) return 0
  const lengths: number[] = []
  for (const o of dates) {
    const next = firstNextPeriodDate(periodStarts, o)
    if (next === null) return 0
    lengths.push(daysBetween(o, next))
  }
  return average(lengths)
}

/** Port of CalculationsHelper.calculateNextPeriod, basic branch. */
function basicNextPeriod(
  periodStarts: ISODate[],
  periodHistory: number,
  baselineCycleLength?: number,
): ISODate | null {
  const dates = latestPeriodStarts(periodStarts, periodHistory)
  if (dates.length < 2) {
    const baseline =
      baselineCycleLength !== undefined && Number.isFinite(baselineCycleLength)
        ? Math.min(60, Math.max(15, Math.trunc(baselineCycleLength)))
        : null
    return dates.length === 1 && baseline ? addDays(dates[0], baseline) : null
  }
  const avg = average(consecutiveDiffs(dates))
  // Kotlin: averageLength.toLong() — truncates toward zero.
  return addDays(dates[dates.length - 1], Math.trunc(avg))
}

/** Port of CalculationsHelper.advancedNextPeriod (ovulation-anchored). */
function lutealNextPeriod(
  periodStarts: ISODate[],
  ovulations: ISODate[],
  ovulationHistory: number,
): ISODate | null {
  const ovsWithPeriod = ovulationsWithPeriod(periodStarts, ovulations, ovulationHistory)
  if (ovsWithPeriod.length === 0) return null

  let lutealSum = 0
  for (const o of ovsWithPeriod) {
    const next = firstNextPeriodDate(periodStarts, o)
    lutealSum += next === null ? 0 : daysBetween(o, next)
  }
  // Kotlin: Int / Int — floors.
  const avgLuteal = Math.floor(lutealSum / ovsWithPeriod.length)

  const lastOvulation = ovulations[ovulations.length - 1]
  if (!lastOvulation) return null

  const lastPeriodStart = periodStarts[periodStarts.length - 1]
  if (lastPeriodStart && toEpochDay(lastPeriodStart) > toEpochDay(lastOvulation)) {
    // A period already started after the last logged ovulation: anchor on the
    // *expected* next ovulation instead.
    const growth = averageFollicularGrowthInDays(periodStarts, ovulations, ovulationHistory)
    const expectedOvulation = addDays(lastPeriodStart, Math.trunc(growth))
    return addDays(expectedOvulation, avgLuteal)
  }
  return addDays(lastOvulation, avgLuteal)
}

/**
 * Port of PeriodPrediction.getPredictedPeriodDate with its <2-periods guard,
 * plus two EXTENSION policies that keep the result presentable:
 * stale history yields no forecast, and an anchor that has drifted past its
 * grace window expires instead of silently sitting in the past.
 */
export function predictNextPeriod(input: EngineInput, opts: EngineOptions = {}): ISODate | null {
  const {
    periodHistory = 5,
    ovulationHistory = 5,
    useLutealCalculation = false,
    baselineCycleLength,
  } = opts
  if (hasStaleHistory(input.periodStarts, input.today)) return null

  const candidate =
    useLutealCalculation && input.periodStarts.length >= 2
      ? lutealNextPeriod(input.periodStarts, input.ovulations, ovulationHistory)
      : basicNextPeriod(input.periodStarts, periodHistory, baselineCycleLength)

  if (candidate === null) return null
  const band = uncertaintyDays(input.periodStarts, periodHistory)
  return isForecastAnchorLive(candidate, input.today, band) ? candidate : null
}

/**
 * Port of OvulationPrediction.getPredictedOvulationDate (needs >=2 logged
 * ovulations), plus EXTENSION fallback: predicted period minus an assumed
 * luteal length when ovulation data is missing.
 */
export function predictOvulation(input: EngineInput, opts: EngineOptions = {}): ISODate | null {
  const { ovulationHistory = 5, defaultLutealDays = 14 } = opts
  const { periodStarts, ovulations } = input
  const predictedPeriod = predictNextPeriod(input, opts)

  if (ovulations.length >= 2 && periodStarts.length >= 2) {
    const lastOvulation = ovulations[ovulations.length - 1]
    const lastPeriodStart = periodStarts[periodStarts.length - 1]
    const growth = Math.trunc(averageFollicularGrowthInDays(periodStarts, ovulations, ovulationHistory))
    if (growth > 0) {
      if (toEpochDay(lastOvulation) < toEpochDay(lastPeriodStart)) {
        return addDays(lastPeriodStart, growth)
      }
      if (predictedPeriod !== null) return addDays(predictedPeriod, growth)
    }
    return null
  }

  // EXTENSION: calendar fallback used until real ovulation data exists.
  if (predictedPeriod !== null) return addDays(predictedPeriod, -defaultLutealDays)
  return null
}

/**
 * Port of CalculationsHelper.getCycleDay: 1-based, never for future dates.
 *
 * Bounded by MAX_PLAUSIBLE_CYCLE_DAY. Past that the count says nothing about a
 * cycle — it only measures how long ago someone stopped logging — so returning
 * null lets the UI ask for a fresh period date instead of rendering
 * "Cycle day 310".
 */
export function getCycleDay(periodStarts: ISODate[], date: ISODate, today: ISODate): number | null {
  if (toEpochDay(date) > toEpochDay(today)) return null
  const lastStart = firstPreviousPeriodDate(periodStarts, date)
  if (lastStart === null) return null
  const day = daysBetween(lastStart, date) + 1
  if (day < 1 || day > MAX_PLAUSIBLE_CYCLE_DAY) return null
  return day
}

/** Days from the most recent period start on or before `today`. */
export function daysSinceLastPeriodStart(
  periodStarts: ISODate[],
  today: ISODate,
): number | null {
  const lastStart = firstPreviousPeriodDate([...periodStarts].sort(), today)
  return lastStart === null ? null : daysBetween(lastStart, today)
}

/** True when the newest period start is too old to extrapolate a cycle from. */
export function hasStaleHistory(periodStarts: ISODate[], today: ISODate): boolean {
  const elapsed = daysSinceLastPeriodStart(periodStarts, today)
  return elapsed !== null && elapsed > STALE_HISTORY_DAYS
}

/**
 * Whether a period anchor is still worth showing.
 *
 * An estimate that drifted more than the uncertainty band plus the late grace
 * window into the past is expired: continuing to display it produces the
 * "estimated in 0 days" artifact, because the UI clamps a negative countdown.
 */
export function isForecastAnchorLive(
  anchor: ISODate,
  today: ISODate,
  band: number,
): boolean {
  const expiry = toEpochDay(anchor) + Math.max(0, Math.trunc(band)) + LATE_FORECAST_GRACE_DAYS
  return toEpochDay(today) <= expiry
}

/* ------------------------------ EXTENSIONS ------------------------------ */

/** Standard biological six-day fertile window: ovulation −5 … ovulation. */
export function fertileWindow(ovulation: ISODate): { start: ISODate; end: ISODate } {
  return { start: addDays(ovulation, -5), end: ovulation }
}

/**
 * ± band on the period prediction. Wide until ≥3 completed cycles exist,
 * then tracks the sample stddev of recent cycle lengths, clamped to 2–9.
 * (Only 13% of cycles are exactly 28 days — bands must be honest.)
 */
export function uncertaintyDays(periodStarts: ISODate[], periodHistory = 5): number {
  const diffs = consecutiveDiffs(latestPeriodStarts(periodStarts, periodHistory))
  if (diffs.length < 3) return 5
  const mean = average(diffs)
  const variance = average(diffs.map((d) => (d - mean) ** 2)) * (diffs.length / (diffs.length - 1))
  return Math.min(9, Math.max(2, Math.round(Math.sqrt(variance))))
}

/**
 * Displayed-baseline recalibration rule: only shift the user's stored cycle
 * length after 3 consecutive cycles deviating by more than `tolerance` days;
 * a single anomalous cycle never moves the baseline.
 */
export function recalibrateBaseline(
  baseline: number,
  recentCycleLengths: number[],
  tolerance = 2,
): number {
  const last3 = recentCycleLengths.slice(-3)
  if (last3.length < 3) return baseline
  if (last3.every((len) => Math.abs(len - baseline) > tolerance)) {
    return Math.round(average(last3))
  }
  return baseline
}

/** One-call summary for the UI. */
export function predict(input: EngineInput, opts: EngineOptions = {}): Prediction {
  const useLuteal =
    opts.useLutealCalculation ?? input.ovulations.length >= 2
  const merged = { ...opts, useLutealCalculation: useLuteal }
  const baselineCycleLength =
    merged.baselineCycleLength !== undefined && Number.isFinite(merged.baselineCycleLength)
      ? Math.min(60, Math.max(15, Math.trunc(merged.baselineCycleLength)))
      : 0

  const nextPeriodStart = predictNextPeriod(input, merged)
  const ovulationDate = predictOvulation(input, merged)
  return {
    nextPeriodStart,
    ovulationDate,
    fertileWindow: ovulationDate ? fertileWindow(ovulationDate) : null,
    uncertaintyDays: uncertaintyDays(input.periodStarts, merged.periodHistory),
    cycleDay: getCycleDay(input.periodStarts, input.today, input.today),
    averageCycleLength:
      averageCycleLength(input.periodStarts, merged.periodHistory) || baselineCycleLength,
    source:
      nextPeriodStart === null
        ? 'insufficient-data'
        : input.periodStarts.length < 2
          ? 'baseline'
          : useLuteal
            ? 'luteal'
            : 'basic',
  }
}
