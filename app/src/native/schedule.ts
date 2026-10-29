/**
 * Local reminders for the redesign (decisions B3 and spec §5.9): method
 * reminders for pill/patch/ring/shot/implant/IUD, a daily check-in nudge in the
 * chosen tone, and an optional heads-up when the estimated window opens.
 *
 * Lock-screen copy never names a symptom, a phase, a method or the word
 * "period". Everything is recomputed from local data and rescheduled as a
 * whole, capped below iOS's 64 pending-notification limit.
 */
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import { db, getHealthProfile } from '../db/schema'
import { activeRegimenOn, type RegimenRecord } from '../db/regimen'
import { addDays, daysBetween } from '../engine/cycle'
import { computeCycleState } from '../engine/estimate'
import { currentT } from '../i18n'
import { localToday } from '../lib/dates'
import { readPrefs, type Prefs } from '../state/prefs'
import { isNative } from './runtime'

const ID_BASE = 20_000
const MAX = 60
const HORIZON_DAYS = 35
const CHANNEL = 'meztli-reminders'

export interface PlannedReminder {
  date: string
  time: string
  kind: 'method' | 'check-in' | 'window'
}

/** Days within the horizon on which a method needs attention. Pure, testable. */
export function methodReminderDates(record: RegimenRecord | undefined, today: string, horizon = HORIZON_DAYS): string[] {
  const c = record?.config
  if (!c) return []
  const days = Array.from({ length: horizon }, (_, i) => addDays(today, i))
  const mod = (n: number, m: number) => ((n % m) + m) % m
  switch (c.kind) {
    case 'pill': {
      if (!c.currentPackStart) return days
      const len = c.activePillsPerPack + c.placeboPillsPerPack
      // Placebo pills are still taken; only a true pill-free gap (21/7, 84/7) skips.
      const pillFree = c.placeboPillsPerPack > 0 && (c.activePillsPerPack === 21 || c.activePillsPerPack === 84)
      return days.filter((d) => !pillFree || mod(daysBetween(c.currentPackStart!, d), len) < c.activePillsPerPack)
    }
    case 'patch': {
      if (!c.currentPatchStart) return []
      const len = c.cycle.wearDays + c.cycle.ringFreeDays
      return days.filter((d) => {
        const into = mod(daysBetween(c.currentPatchStart!, d), len)
        return into % 7 === 0 && into <= c.cycle.wearDays && daysBetween(c.currentPatchStart!, d) > 0
      })
    }
    case 'ring': {
      if (!c.currentRingStart) return []
      const len = c.cycle.wearDays + c.cycle.ringFreeDays
      return days.filter((d) => {
        const into = mod(daysBetween(c.currentRingStart!, d), len)
        return (into === c.cycle.wearDays || into === 0) && daysBetween(c.currentRingStart!, d) > 0
      })
    }
    case 'injection': {
      if (!c.lastInjectionDate) return []
      const due = addDays(c.lastInjectionDate, c.intervalDays)
      return [addDays(due, -7), due].filter((d) => d >= today && d <= addDays(today, horizon))
    }
    case 'implant':
    case 'iud': {
      const by = c.kind === 'implant' ? c.plannedRemovalDate : c.plannedReplacementDate
      if (!by) return []
      return [addDays(by, -30), addDays(by, -7)].filter((d) => d >= today && d <= addDays(today, horizon))
    }
    default:
      return []
  }
}

export function planReminders(args: {
  prefs: Prefs
  today: string
  regimen: RegimenRecord | undefined
  windowStart: string | null
}): PlannedReminder[] {
  const { prefs, today } = args
  if (prefs.notificationTone === 'off') return []
  const out: PlannedReminder[] = []
  if (prefs.methodReminderTime) {
    for (const date of methodReminderDates(args.regimen, today)) out.push({ date, time: prefs.methodReminderTime, kind: 'method' })
  }
  if (prefs.checkInReminderTime && prefs.notificationTone !== 'minimal') {
    for (let i = 0; i < 14; i++) out.push({ date: addDays(today, i), time: prefs.checkInReminderTime, kind: 'check-in' })
  }
  if (prefs.windowReminder && args.windowStart && args.windowStart >= today) {
    out.push({ date: args.windowStart, time: '09:00', kind: 'window' })
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, MAX)
}

function copy(kind: PlannedReminder['kind'], tone: Prefs['notificationTone']): { title: string; body: string } {
  const t = currentT()
  const k = kind === 'check-in' ? `notify.checkIn.${tone === 'warm' ? 'warm' : 'neutral'}` : `notify.${kind}`
  return { title: t('notify.title'), body: t(k as Parameters<typeof t>[0]) }
}

export async function scheduleAllReminders(): Promise<number> {
  if (!isNative) return 0
  const [prefs, regimens, logs, lifeEvents, profile] = await Promise.all([
    readPrefs(),
    db.regimenRecords.toArray(),
    db.dailyLogs.toArray(),
    db.lifeEvents.toArray(),
    getHealthProfile(),
  ])
  const today = localToday()
  const state = computeCycleState({ today, logs, regimens, lifeEvents, profile })
  const plan = planReminders({
    prefs,
    today,
    regimen: activeRegimenOn(regimens, today),
    windowStart: state.status === 'ok' ? (state.window?.start ?? null) : null,
  })

  const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }))
  const ours = pending.notifications.filter((n) => n.id >= ID_BASE && n.id < ID_BASE + 1000).map(({ id }) => ({ id }))
  if (ours.length) await LocalNotifications.cancel({ notifications: ours })
  if (!plan.length) return 0

  const perm = await LocalNotifications.checkPermissions()
  if (perm.display !== 'granted') return 0
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: currentT()('notify.channel'),
    importance: 3,
    visibility: 0,
  }).catch(() => undefined)

  const now = Date.now()
  const notifications: LocalNotificationSchema[] = plan
    .map((r, i) => {
      const [h, m] = r.time.split(':').map(Number)
      const at = new Date(`${r.date}T00:00:00`)
      at.setHours(h, m, 0, 0)
      return { r, i, at }
    })
    .filter(({ at }) => at.getTime() > now + 30_000)
    .map(({ r, i, at }) => ({
      id: ID_BASE + i,
      ...copy(r.kind, prefs.notificationTone),
      channelId: CHANNEL,
      schedule: { at, allowWhileIdle: true },
      extra: { route: r.kind === 'check-in' ? 'log' : 'today' },
    }))
  if (notifications.length) await LocalNotifications.schedule({ notifications })
  return notifications.length
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!isNative) return false
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true
  return (await LocalNotifications.requestPermissions()).display === 'granted'
}
