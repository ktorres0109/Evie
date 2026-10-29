/**
 * Small user preferences kept in the local settings table, read reactively.
 * Nothing here is health data, but it still never leaves the device.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'

export type ThemePref = 'night' | 'day' | 'system'
export type NotificationTone = 'warm' | 'neutral' | 'minimal' | 'off'
export type AppRole = 'owner' | 'partner'

export interface Prefs {
  theme: ThemePref
  /** Fertility-awareness mode: off by default, on only after the explicit acknowledgement. */
  fertilityMode: boolean
  fertilityAckAt: string | null
  calendarFertilityOverlay: boolean
  notificationTone: NotificationTone
  hideInSwitcher: boolean
  role: AppRole | null
  /** Lifetime check-ins already celebrated, so growth cross-fades only once per stage. */
  plantStageSeen: number
  /** HH:MM for pill/patch/ring reminders, or null for none. */
  methodReminderTime: string | null
  /** HH:MM for a daily check-in nudge, or null for none. */
  checkInReminderTime: string | null
  /** A heads-up when the estimated window starts. */
  windowReminder: boolean
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'night',
  fertilityMode: false,
  fertilityAckAt: null,
  calendarFertilityOverlay: false,
  notificationTone: 'neutral',
  hideInSwitcher: true,
  role: null,
  plantStageSeen: 0,
  methodReminderTime: null,
  checkInReminderTime: null,
  windowReminder: false,
}

const KEY = 'prefs.v1'

export async function readPrefs(): Promise<Prefs> {
  const row = await db.settings.get(KEY)
  if (!row) return DEFAULT_PREFS
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(row.value) as Partial<Prefs>) }
  } catch {
    return DEFAULT_PREFS
  }
}

export async function updatePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await readPrefs()), ...patch }
  await db.settings.put({ key: KEY, value: JSON.stringify(next) })
  applyTheme(next.theme)
  return next
}

export function usePrefs(): Prefs | undefined {
  return useLiveQuery(readPrefs, [])
}

/** Sets data-theme on <html>. "system" follows the OS between Night and Day Bloom. */
export function applyTheme(theme: ThemePref): void {
  if (typeof document === 'undefined') return
  const prefersLight = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
  const resolved = theme === 'system' ? (prefersLight ? 'day' : 'night') : theme
  document.documentElement.dataset.theme = resolved
  const color = resolved === 'day' ? '#FAF7F6' : '#14111C'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  void import('../native/runtime').then((m) => m.setSystemBarColors?.(resolved)).catch(() => undefined)
}
