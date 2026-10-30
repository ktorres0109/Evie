/**
 * Reactive access to the local records and the computed cycle state.
 * Every owner screen reads from here, so they all agree on one estimate.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db, getHealthProfile, dailyLogHasEntry, type DailyLog, type HealthProfile, type LifeEvent } from '../db/schema'
import type { RegimenRecord } from '../db/regimen'
import { companionState, computeCycleState, type CompanionState, type CycleState } from '../engine/estimate'
import { localToday } from '../lib/dates'

export interface CycleData {
  today: string
  logs: DailyLog[]
  logsByDate: Map<string, DailyLog>
  regimens: RegimenRecord[]
  lifeEvents: LifeEvent[]
  profile: HealthProfile
  state: CycleState
  companion: CompanionState
}

export function useCycleData(): CycleData | undefined {
  const raw = useLiveQuery(async () => {
    const [logs, regimens, lifeEvents, profile] = await Promise.all([
      db.dailyLogs.toArray(),
      db.regimenRecords.toArray(),
      db.lifeEvents.toArray(),
      getHealthProfile(),
    ])
    return { logs, regimens, lifeEvents, profile }
  }, [])
  const today = useLocalToday()
  return useMemo(() => {
    if (!raw) return undefined
    const logs = [...raw.logs].sort((a, b) => a.date.localeCompare(b.date))
    const state = computeCycleState({
      today,
      logs,
      regimens: raw.regimens,
      lifeEvents: raw.lifeEvents,
      profile: raw.profile,
    })
    const entryDates = logs.filter(dailyLogHasEntry).map((l) => l.date)
    return {
      today,
      logs,
      logsByDate: new Map(logs.map((l) => [l.date, l])),
      regimens: raw.regimens,
      lifeEvents: raw.lifeEvents,
      profile: raw.profile,
      state,
      companion: companionState(entryDates, today, state.lastPeriodStart),
    }
  }, [raw, today])
}

/** Today's local date, refreshed across midnight and when the app comes back. */
function useLocalToday(): string {
  const [today, setToday] = useState(localToday)
  useEffect(() => {
    const check = () => setToday(localToday())
    const id = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}
