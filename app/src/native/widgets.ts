import { getMeztliNativeBridge } from './bridge'
import { isNative, nativePlatform } from './runtime'

export interface CycleWidgetSnapshot {
  generatedAt: string
  headline: string
  detail?: string
  cycleDay?: number
  phase?: 'period' | 'follicular' | 'fertile' | 'ovulation' | 'luteal' | 'pregnancy'
  nextPeriodDate?: string
  fertileToday?: boolean
  accent?: string
  /** "Day {n}": the native widget advances n from anchorDate on its own. */
  headlineTemplate?: string
  /** Local yyyy-mm-dd that cycleDay refers to. */
  anchorDate?: string
}

export interface WidgetStatus {
  /** True when this build includes a native home-screen widget. */
  available: boolean
  /** True when the app can persist the redacted snapshot consumed by the widget. */
  publisherAvailable: boolean
  extensionInstalled: boolean
  backgroundRefreshConfigured: boolean
  configuredWidgets?: number
  platform: 'ios' | 'android' | 'web'
}

interface MeztliNativeWidgetPlugin {
  widgetStatus(): Promise<WidgetStatus>
  publishWidgetSnapshot(options: { snapshot: CycleWidgetSnapshot }): Promise<void>
  clearWidgetSnapshot(): Promise<void>
}

const MeztliNative = getMeztliNativeBridge<MeztliNativeWidgetPlugin>()

function normalizedSnapshot(snapshot: CycleWidgetSnapshot): CycleWidgetSnapshot {
  if (!Number.isFinite(Date.parse(snapshot.generatedAt))) {
    throw new Error('Widget snapshot generatedAt must be a valid ISO date.')
  }

  const headline = snapshot.headline.trim().slice(0, 80)
  if (!headline) throw new Error('Widget snapshot headline is required.')

  return {
    generatedAt: snapshot.generatedAt,
    headline,
    detail: snapshot.detail?.trim().slice(0, 140),
    cycleDay:
      snapshot.cycleDay !== undefined
        ? Math.max(1, Math.min(999, Math.trunc(snapshot.cycleDay)))
        : undefined,
    phase: snapshot.phase,
    nextPeriodDate: snapshot.nextPeriodDate,
    fertileToday: snapshot.fertileToday,
    accent: snapshot.accent?.slice(0, 20),
    headlineTemplate: snapshot.headlineTemplate?.slice(0, 80),
    anchorDate: snapshot.anchorDate,
  }
}

export async function getWidgetStatus(): Promise<WidgetStatus> {
  if (!isNative) {
    return {
      available: false,
      publisherAvailable: false,
      extensionInstalled: false,
      backgroundRefreshConfigured: false,
      platform: 'web',
    }
  }
  return MeztliNative.widgetStatus()
}

/** Persists only the redacted snapshot contract consumed by the native widget. */
export async function publishWidgetSnapshot(snapshot: CycleWidgetSnapshot): Promise<void> {
  if (!isNative) return
  await MeztliNative.publishWidgetSnapshot({ snapshot: normalizedSnapshot(snapshot) })
}

export async function clearWidgetSnapshot(): Promise<void> {
  if (!isNative) return
  await MeztliNative.clearWidgetSnapshot()
}

export function currentWidgetPlatform(): WidgetStatus['platform'] {
  return isNative && (nativePlatform === 'ios' || nativePlatform === 'android')
    ? nativePlatform
    : 'web'
}

/**
 * What the home-screen widget may show. Private by default: the app name and a
 * nudge. With her opt-in (and no app lock) it adds the day and the next range,
 * never fertility. Pure, so it can be tested.
 */
export function widgetSnapshotFor(args: {
  showCycle: boolean
  locked: boolean
  appName: string
  privateDetail: string
  headline: string | null
  detail: string | null
  now: Date
  /** When set, the widget keeps counting the cycle day between app opens. */
  counting?: { template: string; cycleDay: number; today: string }
}): CycleWidgetSnapshot {
  const base = { generatedAt: args.now.toISOString(), headline: args.appName, detail: args.privateDetail }
  if (!args.showCycle || args.locked || !args.headline) return base
  return {
    ...base,
    headline: args.headline,
    detail: args.detail ?? args.privateDetail,
    ...(args.counting
      ? { headlineTemplate: args.counting.template, cycleDay: args.counting.cycleDay, anchorDate: args.counting.today }
      : {}),
  }
}
