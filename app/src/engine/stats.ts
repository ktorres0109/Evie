import { daysBetween, type ISODate } from './cycle'
import type { DailyLog, Flow } from '../db/schema'

export interface CompletedCycle {
  start: ISODate
  /** Days from this start to the next one. */
  length: number
}

export function completedCycles(periodStarts: ISODate[]): CompletedCycle[] {
  const out: CompletedCycle[] = []
  for (let i = 0; i < periodStarts.length - 1; i++) {
    out.push({ start: periodStarts[i], length: daysBetween(periodStarts[i], periodStarts[i + 1]) })
  }
  return out
}

/** Consecutive flow-day runs → period episodes with day counts. */
export function periodEpisodes(flowDates: ISODate[]): { start: ISODate; days: number }[] {
  const sorted = [...flowDates].sort()
  const out: { start: ISODate; days: number }[] = []
  for (const d of sorted) {
    const last = out[out.length - 1]
    if (last && daysBetween(last.start, d) === last.days) last.days += 1
    else out.push({ start: d, days: 1 })
  }
  return out
}

export type TrendDirection = 'shorter' | 'stable' | 'longer' | 'insufficient-data'

export interface CycleWindowStatistics {
  /** Requested lookback. A six-cycle result never silently includes twelve cycles. */
  windowCycles: 6 | 12
  sampleSize: number
  averageDays: number | null
  medianDays: number | null
  shortestDays: number | null
  longestDays: number | null
  rangeDays: number | null
  /** Least-squares direction in days per completed cycle. Descriptive, not predictive. */
  trendDaysPerCycle: number | null
  trendDirection: TrendDirection
  methodology: string
}

function rounded(value: number, places = 1): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : rounded((sorted[middle - 1] + sorted[middle]) / 2, 1)
}

function linearSlope(values: number[]): number | null {
  if (values.length < 3) return null
  const xMean = (values.length - 1) / 2
  const yMean = values.reduce((sum, value) => sum + value, 0) / values.length
  let numerator = 0
  let denominator = 0
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean)
    denominator += (index - xMean) ** 2
  })
  return denominator ? numerator / denominator : 0
}

/**
 * Describes either the latest six or twelve completed cycles. The trend label
 * requires at least three cycles and a 0.75-day-per-cycle slope so tiny changes
 * are not presented as a meaningful direction.
 */
export function cycleWindowStatistics(
  periodStarts: ISODate[],
  windowCycles: 6 | 12,
): CycleWindowStatistics {
  const lengths = completedCycles([...new Set(periodStarts)].sort())
    .slice(-windowCycles)
    .map((cycle) => cycle.length)
  const slope = linearSlope(lengths)
  const trendDirection: TrendDirection =
    slope == null
      ? 'insufficient-data'
      : slope <= -0.75
        ? 'shorter'
        : slope >= 0.75
          ? 'longer'
          : 'stable'
  return {
    windowCycles,
    sampleSize: lengths.length,
    averageDays: lengths.length
      ? rounded(lengths.reduce((sum, length) => sum + length, 0) / lengths.length, 1)
      : null,
    medianDays: median(lengths),
    shortestDays: lengths.length ? Math.min(...lengths) : null,
    longestDays: lengths.length ? Math.max(...lengths) : null,
    rangeDays: lengths.length ? Math.max(...lengths) - Math.min(...lengths) : null,
    trendDaysPerCycle: slope == null ? null : rounded(slope, 1),
    trendDirection,
    methodology:
      `Uses the latest ${Math.min(lengths.length, windowCycles)} completed cycle${
        lengths.length === 1 ? '' : 's'
      }. Direction is a descriptive straight-line slope, not a forecast or diagnosis.`,
  }
}

const FLOW_WEIGHT: Record<Flow, number> = {
  light: 1,
  medium: 2,
  heavy: 3,
  'very-heavy': 4,
  clots: 4,
}

export interface PeriodEpisodeDetail {
  start: ISODate
  days: number
  knownFlowDays: number
  heaviestFlow: Flow | null
  heavyOrClotDays: number
}

export interface BleedingTrendSummary {
  episodes: PeriodEpisodeDetail[]
  sampleSize: number
  averageDays: number | null
  averageKnownFlowDays: number | null
  latestDays: number | null
  lengthTrendDaysPerEpisode: number | null
  direction: TrendDirection
  methodology: string
}

/** Consecutive logged-flow dates become descriptive bleeding episodes. */
export function periodEpisodeDetails(logs: Pick<DailyLog, 'date' | 'flow'>[]): PeriodEpisodeDetail[] {
  const flowLogs = logs
    .filter((log): log is { date: ISODate; flow: Flow } => Boolean(log.flow))
    .sort((a, b) => a.date.localeCompare(b.date))
  const episodes: PeriodEpisodeDetail[] = []
  for (const log of flowLogs) {
    const latest = episodes[episodes.length - 1]
    if (latest && daysBetween(latest.start, log.date) === latest.days) {
      latest.days += 1
      latest.knownFlowDays += 1
      latest.heavyOrClotDays += log.flow === 'heavy' || log.flow === 'clots' ? 1 : 0
      if (
        latest.heaviestFlow == null ||
        FLOW_WEIGHT[log.flow] > FLOW_WEIGHT[latest.heaviestFlow]
      ) {
        latest.heaviestFlow = log.flow
      }
      continue
    }
    episodes.push({
      start: log.date,
      days: 1,
      knownFlowDays: 1,
      heaviestFlow: log.flow,
      heavyOrClotDays: log.flow === 'heavy' || log.flow === 'very-heavy' || log.flow === 'clots' ? 1 : 0,
    })
  }
  return episodes
}

export function bleedingTrend(
  logs: Pick<DailyLog, 'date' | 'flow'>[],
  windowEpisodes: 6 | 12 = 6,
): BleedingTrendSummary {
  const episodes = periodEpisodeDetails(logs).slice(-windowEpisodes)
  const lengths = episodes.map((episode) => episode.days)
  const slope = linearSlope(lengths)
  return {
    episodes,
    sampleSize: episodes.length,
    averageDays: lengths.length
      ? rounded(lengths.reduce((sum, length) => sum + length, 0) / lengths.length, 1)
      : null,
    averageKnownFlowDays: episodes.length
      ? rounded(
          episodes.reduce((sum, episode) => sum + episode.knownFlowDays, 0) / episodes.length,
          1,
        )
      : null,
    latestDays: lengths.at(-1) ?? null,
    lengthTrendDaysPerEpisode: slope == null ? null : rounded(slope, 1),
    direction:
      slope == null
        ? 'insufficient-data'
        : slope <= -0.75
          ? 'shorter'
          : slope >= 0.75
            ? 'longer'
            : 'stable',
    methodology:
      'Consecutive dates with a selected flow level are treated as one episode. Missing flow dates are not filled in, so an episode can look shorter than the bleeding actually was.',
  }
}

export interface TrackingCompleteness {
  windowDays: number
  daysWithAnyEntry: number
  completeCheckInDays: number
  entryCoveragePercent: number
  completeCoveragePercent: number
  phaseComparisonReady: boolean
  methodology: string
}

/** Coverage distinguishes an explicit complete check-in from a partially logged day. */
export function trackingCompleteness(
  logs: Pick<DailyLog, 'date' | 'checkInComplete'>[],
  today: ISODate,
  windowDays = 90,
): TrackingCompleteness {
  const end = new Date(`${today}T00:00:00Z`).getTime()
  const start = end - (windowDays - 1) * 86_400_000
  const inWindow = logs.filter((log) => {
    const epoch = new Date(`${log.date}T00:00:00Z`).getTime()
    return epoch >= start && epoch <= end
  })
  const daysWithAnyEntry = new Set(inWindow.map((log) => log.date)).size
  const completeCheckInDays = new Set(
    inWindow.filter((log) => log.checkInComplete === true).map((log) => log.date),
  ).size
  return {
    windowDays,
    daysWithAnyEntry,
    completeCheckInDays,
    entryCoveragePercent: Math.round((daysWithAnyEntry / windowDays) * 100),
    completeCoveragePercent: Math.round((completeCheckInDays / windowDays) * 100),
    phaseComparisonReady: completeCheckInDays >= 14,
    methodology:
      'Entry coverage counts any saved day. Complete coverage counts only days explicitly marked complete; an unlogged or partial day is never treated as symptom-free.',
  }
}

export interface FertilitySignalPoint {
  date: ISODate
  cycleStart: ISODate | null
  cycleDay: number | null
  bbtCelsius?: number
  opk?: 'positive' | 'negative'
}

/** A plotting series only. It does not confirm ovulation or infer pregnancy. */
export function fertilitySignalSeries(
  logs: Pick<DailyLog, 'date' | 'bbt' | 'opk'>[],
  periodStarts: ISODate[],
): FertilitySignalPoint[] {
  const starts = [...new Set(periodStarts)].sort()
  return logs
    .filter((log) => log.bbt !== undefined || log.opk !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((log) => {
      const cycleStart =
        [...starts].reverse().find((start) => start.localeCompare(log.date) <= 0) ?? null
      return {
        date: log.date,
        cycleStart,
        cycleDay: cycleStart ? daysBetween(cycleStart, log.date) + 1 : null,
        bbtCelsius: log.bbt === undefined ? undefined : log.bbt / 100,
        opk: log.opk,
      }
    })
}

export interface TrackingEra {
  start: ISODate
  end?: ISODate
  label: string
  kind: 'hormonal-contraception' | 'nonhormonal-contraception' | 'pregnancy' | 'postpartum' | 'other'
}

export interface CycleEraAnnotation {
  cycleStart: ISODate
  labels: string[]
}

/**
 * Hook for future contraception/pregnancy history. No era is invented from a
 * current setting; callers must supply dated intervals explicitly.
 */
export function annotateCycleEras(
  cycles: CompletedCycle[],
  eras: TrackingEra[] = [],
): CycleEraAnnotation[] {
  return cycles.map((cycle) => {
    const cycleEnd = new Date(`${cycle.start}T00:00:00Z`).getTime() + (cycle.length - 1) * 86_400_000
    const labels = eras
      .filter((era) => {
        const eraStart = new Date(`${era.start}T00:00:00Z`).getTime()
        const eraEnd = era.end
          ? new Date(`${era.end}T00:00:00Z`).getTime()
          : Number.POSITIVE_INFINITY
        const cycleStart = new Date(`${cycle.start}T00:00:00Z`).getTime()
        return eraStart <= cycleEnd && eraEnd >= cycleStart
      })
      .map((era) => era.label)
    return { cycleStart: cycle.start, labels: [...new Set(labels)] }
  })
}

export function symptomFrequency(
  logs: { symptoms?: string[]; moods?: string[]; events?: string[] }[],
): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const log of logs) {
    for (const s of [...(log.symptoms ?? []), ...(log.moods ?? []), ...(log.events ?? [])]) {
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export interface IrregularityReport {
  /** Range (max−min) of recent cycle lengths. */
  rangeDays: number
  classification: 'regular' | 'somewhat-irregular' | 'irregular' | 'insufficient-data'
}

/**
 * Perimenopause-basic irregularity signal. Follows the common clinical
 * framing: persistent ≥7-day variation is a hallmark of the menopausal
 * transition. Informational only — never diagnostic.
 */
export function irregularity(periodStarts: ISODate[], window = 6): IrregularityReport {
  const lengths = completedCycles(periodStarts).slice(-window).map((c) => c.length)
  if (lengths.length < 3) return { rangeDays: 0, classification: 'insufficient-data' }
  const rangeDays = Math.max(...lengths) - Math.min(...lengths)
  return {
    rangeDays,
    classification: rangeDays < 4 ? 'regular' : rangeDays < 7 ? 'somewhat-irregular' : 'irregular',
  }
}

/**
 * Perimenopause-basic symptom-severity score for a date range: share of days
 * with any peri-associated symptom logged, scaled 0–10.
 */
export function periSeverityScore(
  logs: { symptoms?: string[]; moods?: string[] }[],
  periSymptoms: readonly string[],
): number {
  if (logs.length === 0) return 0
  const days = logs.filter((l) =>
    [...(l.symptoms ?? []), ...(l.moods ?? [])].some((s) => periSymptoms.includes(s)),
  ).length
  return Math.round((days / logs.length) * 10)
}
