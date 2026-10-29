/**
 * Owner-side automatic upload. Whenever the estimate or consent changes, the
 * snapshot is rebuilt; it is sealed and sent only if it differs from the last
 * one, plus once a day so the partner's "updated" line stays honest.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { recordTransfer } from '../db/ledger'
import type { CycleData } from '../state/useCycle'
import { PADDED_SIZE, seal } from './crypto'
import { hostOf } from './pairing'
import { relay, RelayError } from './relay'
import { buildSnapshot, snapshotKey } from './snapshot'
import { getSecret, readPartner, writePartner, type OwnerPartnerState } from './store'

const DAY_MS = 20 * 60 * 60 * 1000
let inFlight: Promise<unknown> | null = null

export async function uploadNow(data: CycleData, force = false): Promise<'sent' | 'skipped' | 'error'> {
  const partner = await readPartner()
  if (partner.status !== 'paired') return 'skipped'
  const secrets = await getSecret('partner-owner-keys')
  if (!secrets?.writeToken) return 'error'
  const snapshot = buildSnapshot({ partner, state: data.state, todayLog: data.logsByDate.get(data.today), now: new Date().toISOString() })
  const key = snapshotKey(snapshot)
  const recent = partner.lastUploadAt && Date.now() - new Date(partner.lastUploadAt).getTime() < DAY_MS
  if (!force && key === partner.lastKey && recent) return 'skipped'

  const send = async (version: number): Promise<number> => {
    const box = await seal(secrets.contentKey, partner.mailboxId, version, snapshot)
    await relay.put(partner.relayUrl, partner.mailboxId, secrets.writeToken!, box)
    return version
  }
  try {
    let version = partner.version + 1
    try {
      version = await send(version)
    } catch (e) {
      // Another device or a restore may have moved the version on; catch up once.
      if (e instanceof RelayError && e.status === 409) version = await send(version + 1000)
      else throw e
    }
    await writePartner({ version, lastKey: key, lastUploadAt: new Date().toISOString(), lastUploadError: null })
    await recordTransfer('partner-update', hostOf(partner.relayUrl), PADDED_SIZE)
    return 'sent'
  } catch (e) {
    await writePartner({ lastUploadError: e instanceof Error ? e.message : String(e) })
    return 'error'
  }
}

export function usePartnerAutoUpload(data: CycleData | undefined): void {
  const partner = useLiveQuery(readPartner, []) as OwnerPartnerState | undefined
  const dep = partner ? `${partner.status}|${partner.paused}|${JSON.stringify(partner.scopes)}|${partner.supportLines.join('\n')}` : ''
  useEffect(() => {
    if (!data || partner?.status !== 'paired') return
    const timer = window.setTimeout(() => {
      if (inFlight) return
      inFlight = uploadNow(data).finally(() => {
        inFlight = null
      })
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [data, dep, partner?.status])
}
