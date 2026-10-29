/**
 * Writes for daily logs. Every control in the log writes immediately (spec
 * §5.3: "the button at the bottom dismisses, it does not save"), so these are
 * small, idempotent patches rather than a form submit.
 */
import { clearHealthImportProvenance, db, dailyLogHasEntry, type DailyLog, type Flow, type HealthImportField } from './schema'
import { addDays } from '../engine/cycle'

export type BleedingChoice = 'none' | 'spotting' | Flow

export async function getLog(date: string): Promise<DailyLog> {
  return (await db.dailyLogs.get(date)) ?? { date }
}

/** Merge a patch into the day and persist it. Empty days are deleted. */
export async function patchLog(
  date: string,
  patch: Partial<DailyLog> | ((log: DailyLog) => Partial<DailyLog>),
  edited: HealthImportField[] = [],
): Promise<DailyLog> {
  return db.transaction('rw', db.dailyLogs, async () => {
    const current = await getLog(date)
    const changes = typeof patch === 'function' ? patch(current) : patch
    let next: DailyLog = { ...current, ...changes, date }
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || (Array.isArray(value) && value.length === 0) || value === '') {
        delete (next as unknown as Record<string, unknown>)[key]
      }
    }
    if (edited.length) next = clearHealthImportProvenance(next, edited)
    if (dailyLogHasEntry(next)) await db.dailyLogs.put(next)
    else await db.dailyLogs.delete(date)
    return next
  })
}

export function bleedingOf(log: DailyLog | undefined): BleedingChoice | undefined {
  if (!log) return undefined
  if (log.flow) return log.flow === 'clots' ? 'heavy' : log.flow
  if (log.spotting) return 'spotting'
  if (log.noBleeding) return 'none'
  return undefined
}

/**
 * True when choosing period flow on this day would start a new period, i.e.
 * no period flow on the two days before or the day after. The UI asks
 * "Is this the start of your period?" only then.
 */
export async function wouldStartPeriod(date: string): Promise<boolean> {
  const around = await db.dailyLogs.bulkGet([addDays(date, -2), addDays(date, -1), addDays(date, 1)])
  return !around.some((log) => log?.flow)
}

export async function setBleeding(date: string, choice: BleedingChoice | undefined): Promise<DailyLog> {
  return patchLog(
    date,
    {
      flow: choice && choice !== 'none' && choice !== 'spotting' ? choice : undefined,
      spotting: choice === 'spotting' ? true : undefined,
      noBleeding: choice === 'none' ? true : undefined,
      periodStart: undefined,
    },
    ['flow'],
  )
}

export function toggleIn<T>(list: T[] | undefined, value: T): T[] {
  const set = new Set(list ?? [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return [...set]
}

/** Count how often each symptom was logged, for "your most-logged first" ordering. */
export function symptomUsage(logs: DailyLog[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const log of logs) for (const s of log.symptoms ?? []) counts.set(s, (counts.get(s) ?? 0) + 1)
  return counts
}
