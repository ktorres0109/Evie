/**
 * Partner sharing state, on both sides of a pairing.
 *
 * Non-secret state (who, which scopes, paused, last sync) lives in the local
 * settings table. Key material lives in the Keychain / Keystore through the
 * secure vault; in a plain browser (development only) it falls back to the
 * settings table so a reload does not silently unpair.
 */
import { db } from '../db/schema'
import { isNative } from '../native/runtime'
import { deleteSecureSecret, getSecureSecret, setSecureSecret } from '../native/secureVault'

export interface PartnerScopes {
  /** A phase word, not the day number. */
  phase: boolean
  /** A softened period range, never a single date. */
  range: boolean
  /** Support lines the owner writes. */
  support: boolean
  /** Individually chosen symptoms. Off by default; there is no "all" option. */
  symptoms: string[]
}

export const DEFAULT_SCOPES: PartnerScopes = { phase: true, range: true, support: true, symptoms: [] }

/** Owner side. */
export interface OwnerPartnerState {
  status: 'none' | 'paired'
  partnerName: string
  ownerName: string
  scopes: PartnerScopes
  paused: boolean
  supportLines: string[]
  relayUrl: string
  mailboxId: string
  version: number
  lastUploadAt: string | null
  lastUploadError: string | null
  /** Content key of the last uploaded snapshot, to skip unchanged uploads. */
  lastKey: string | null
  pairedAt: string | null
}

/** Partner side (the read-only app). */
export interface ViewerState {
  /** pending = words shown, waiting for the owner to confirm and send the first update. */
  status: 'none' | 'pending' | 'paired' | 'revoked'
  ownerName: string
  /** The 4-word phrase shown while pending. */
  words: string[]
  relayUrl: string
  mailboxId: string
  lastVersion: number
  lastSnapshot: PartnerSnapshot | null
  lastFetchedAt: string | null
  lastFetchError: string | null
  pairedAt: string | null
}

/**
 * The only thing that ever leaves the owner's phone. Every field is optional
 * and present only when its scope is on. No dates of logs, no history, no
 * notes, nothing about sex, tests, BBT/OPK, or medical details.
 */
export interface PartnerSnapshot {
  v: 1
  issuedAt: string
  ownerName: string
  paused: boolean
  phase?: 'period' | 'early' | 'mid' | 'later' | 'window' | 'late' | 'unknown'
  /** Softened: expanded to whole days on each side, never a single date. */
  range?: { start: string; end: string } | null
  rangeWithheld?: boolean
  support?: string[]
  symptoms?: string[]
}

const OWNER_KEY = 'partner.owner.v1'
const VIEWER_KEY = 'partner.viewer.v1'

export const EMPTY_OWNER: OwnerPartnerState = {
  status: 'none',
  partnerName: '',
  ownerName: '',
  scopes: DEFAULT_SCOPES,
  paused: false,
  supportLines: [],
  relayUrl: '',
  mailboxId: '',
  version: 0,
  lastUploadAt: null,
  lastUploadError: null,
  lastKey: null,
  pairedAt: null,
}

export const EMPTY_VIEWER: ViewerState = {
  status: 'none',
  ownerName: '',
  words: [],
  relayUrl: '',
  mailboxId: '',
  lastVersion: 0,
  lastSnapshot: null,
  lastFetchedAt: null,
  lastFetchError: null,
  pairedAt: null,
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  if (!row) return fallback
  try {
    return { ...fallback, ...(JSON.parse(row.value) as Partial<T>) }
  } catch {
    return fallback
  }
}

export const readPartner = () => readJson(OWNER_KEY, EMPTY_OWNER)
export const readViewer = () => readJson(VIEWER_KEY, EMPTY_VIEWER)

export async function writePartner(patch: Partial<OwnerPartnerState>): Promise<OwnerPartnerState> {
  const next = { ...(await readPartner()), ...patch }
  await db.settings.put({ key: OWNER_KEY, value: JSON.stringify(next) })
  return next
}

export async function writeViewer(patch: Partial<ViewerState>): Promise<ViewerState> {
  const next = { ...(await readViewer()), ...patch }
  await db.settings.put({ key: VIEWER_KEY, value: JSON.stringify(next) })
  return next
}

export async function clearPartner(): Promise<void> {
  await db.settings.delete(OWNER_KEY)
  await deleteSecret('partner-owner-keys')
}

export async function clearViewer(): Promise<void> {
  await db.settings.delete(VIEWER_KEY)
  await deleteSecret('partner-viewer-keys')
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

export interface PartnerSecrets {
  /** base64url AES-256 content key. */
  contentKey: string
  /** Bearer tokens for the relay mailbox. */
  writeToken?: string
  readToken?: string
}

export async function putSecret(name: 'partner-owner-keys' | 'partner-viewer-keys', value: PartnerSecrets): Promise<void> {
  const json = JSON.stringify(value)
  if (isNative) await setSecureSecret(name, json)
  else await db.settings.put({ key: `dev-secret.${name}`, value: json })
}

export async function getSecret(name: 'partner-owner-keys' | 'partner-viewer-keys'): Promise<PartnerSecrets | null> {
  const json = isNative ? await getSecureSecret(name) : (await db.settings.get(`dev-secret.${name}`))?.value
  if (!json) return null
  try {
    return JSON.parse(json) as PartnerSecrets
  } catch {
    return null
  }
}

export async function deleteSecret(name: 'partner-owner-keys' | 'partner-viewer-keys'): Promise<void> {
  if (isNative) await deleteSecureSecret(name).catch(() => undefined)
  else await db.settings.delete(`dev-secret.${name}`)
}
