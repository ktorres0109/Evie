import { decryptJSON, encryptJSON, type Envelope } from '../crypto/vault'
import type { MissedDoseEvent, RegimenRecord } from './regimen'
import { db, SK, type ContentBookmark, type DailyLog, type HealthProfile, type LifeEvent, type Setting } from './schema'

/** Settings that must never leave the device: lock secrets and pairing keys. */
const SECRET_KEYS: string[] = [SK.pinSalt, SK.pinHash, SK.aiKey]
const SECRET_PREFIXES = ['dev-secret.', 'partner.']

function exportable(setting: Setting): boolean {
  return !SECRET_KEYS.includes(setting.key) && !SECRET_PREFIXES.some((p) => setting.key.startsWith(p))
}

export interface ExportOptions {
  /** Pregnancy and pregnancy-ending records are left out unless chosen (decision C3). */
  includePregnancyHistory?: boolean
}

export interface ExportPayload {
  app: 'meztli'
  v: 1 | 2
  exportedAt: string
  dailyLogs: DailyLog[]
  settings: Setting[]
  contentBookmarks: ContentBookmark[]
  regimenRecords?: RegimenRecord[]
  missedDoseEvents?: MissedDoseEvent[]
  lifeEvents?: LifeEvent[]
  healthProfiles?: HealthProfile[]
  pregnancyHistoryIncluded?: boolean
}

const PREGNANCY_KINDS = new Set(['pregnancy', 'pregnancy-ended', 'postpartum', 'breastfeeding'])

function withoutPregnancyGoal(goals: HealthProfile['goals']): HealthProfile['goals'] {
  const rest = (goals ?? []).filter((g) => g !== 'pregnancy')
  return rest.length ? rest : ['cycle']
}

export async function collectExport(options: ExportOptions = {}): Promise<ExportPayload> {
  const [dailyLogs, settings, contentBookmarks, regimenRecords, missedDoseEvents, lifeEvents, healthProfiles] = await Promise.all([
    db.dailyLogs.toArray(),
    db.settings.toArray(),
    db.contentBookmarks.toArray(),
    db.regimenRecords.toArray(),
    db.missedDoseEvents.toArray(),
    db.lifeEvents.toArray(),
    db.healthProfiles.toArray(),
  ])
  const includePregnancy = options.includePregnancyHistory === true
  return {
    app: 'meztli',
    v: 2,
    exportedAt: new Date().toISOString(),
    dailyLogs,
    settings: settings.filter(exportable),
    contentBookmarks,
    regimenRecords,
    missedDoseEvents,
    lifeEvents: includePregnancy ? lifeEvents : lifeEvents.filter((e) => !PREGNANCY_KINDS.has(e.kind)),
    healthProfiles: includePregnancy
      ? healthProfiles
      : healthProfiles.map((p) => ({
          ...p,
          primaryGoal: p.primaryGoal === 'pregnancy' ? 'cycle' : p.primaryGoal,
          goals: withoutPregnancyGoal(p.goals),
          reproductive: { ...p.reproductive, pregnancyDating: undefined, pregnancyLmp: undefined },
        })),
    pregnancyHistoryIncluded: includePregnancy,
  }
}

export async function applyImport(payload: ExportPayload): Promise<number> {
  // v1 files were written before the rename and say app: 'lunara'.
  const app = payload.app as string
  const known = (app === 'meztli' && (payload.v === 1 || payload.v === 2)) || (app === 'lunara' && payload.v === 1)
  if (!known) throw new Error('Not a Meztli export file')
  await db.transaction(
    'rw',
    [db.dailyLogs, db.settings, db.contentBookmarks, db.regimenRecords, db.missedDoseEvents, db.lifeEvents, db.healthProfiles],
    async () => {
      await db.dailyLogs.bulkPut(payload.dailyLogs)
      await db.settings.bulkPut(payload.settings.filter(exportable))
      await db.contentBookmarks.bulkPut(payload.contentBookmarks)
      if (payload.regimenRecords) await db.regimenRecords.bulkPut(payload.regimenRecords)
      if (payload.missedDoseEvents) await db.missedDoseEvents.bulkPut(payload.missedDoseEvents)
      if (payload.lifeEvents) await db.lifeEvents.bulkPut(payload.lifeEvents)
      if (payload.healthProfiles) await db.healthProfiles.bulkPut(payload.healthProfiles)
    },
  )
  return payload.dailyLogs.length
}

export async function encryptedExport(passphrase: string, options: ExportOptions = {}): Promise<Envelope> {
  return encryptJSON(await collectExport(options), passphrase)
}

export async function decryptImport(env: Envelope, passphrase: string): Promise<number> {
  return applyImport(await decryptJSON<ExportPayload>(env, passphrase))
}

/** Share-sheet first (iOS → Save to Files → iCloud Drive), download fallback. */
export async function shareOrDownload(filename: string, contents: string): Promise<void> {
  const blob = new Blob([contents], { type: 'application/json' })
  const file = new File([blob], filename, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch {
      // fall through to download (user cancel or share failure)
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
