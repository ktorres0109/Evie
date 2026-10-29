/**
 * Pairing, both sides. Same-room only in spirit: the owner shows a QR code (or
 * a 6-character code), the partner joins, and both phones show four words that
 * must match before the owner confirms. A correct code alone is never enough.
 */
import { recordTransfer } from '../db/ledger'
import { b64url, deriveSession, generateKeyPair, normalizeCode, open, pairingCode, randomBytes, sha256, type SealedBox } from './crypto'
import { relay, RelayError } from './relay'
import { clearPartner, clearViewer, DEFAULT_SCOPES, getSecret, putSecret, readPartner, readViewer, writePartner, writeViewer, type PartnerScopes, type PartnerSnapshot } from './store'

export const PAIR_SECONDS = 180

export interface OwnerPairing {
  relayUrl: string
  code: string
  mailboxId: string
  writeToken: string
  readToken: string
  ownerName: string
  privateKey: string
  ownerPublic: string
  expiresAt: number
  /** The QR payload: a link the partner's camera can open. */
  link: string
}

export async function startOwnerPairing(relayUrl: string, ownerName: string): Promise<OwnerPairing> {
  const kp = await generateKeyPair()
  const mailboxId = b64url(randomBytes(16))
  const writeToken = b64url(randomBytes(24))
  const readToken = b64url(randomBytes(24))
  const code = pairingCode()
  await relay.createBox(relayUrl, mailboxId, await sha256(writeToken), await sha256(readToken))
  await relay.createPair(relayUrl, code, mailboxId, await sha256(writeToken), { ownerPub: kp.publicKey, ownerName, readToken })
  const link = `meztli://pair?c=${code}&r=${encodeURIComponent(relayUrl)}`
  return {
    relayUrl,
    code,
    mailboxId,
    writeToken,
    readToken,
    ownerName,
    privateKey: kp.privateKey,
    ownerPublic: kp.publicKey,
    expiresAt: Date.now() + PAIR_SECONDS * 1000,
    link,
  }
}

export interface PendingConfirm {
  partnerName: string
  words: string[]
  contentKey: string
}

/** Poll once; returns the words to confirm when the partner has joined. */
export async function pollOwnerPairing(p: OwnerPairing): Promise<PendingConfirm | null> {
  const res = await relay.readAnswer(p.relayUrl, p.code, p.writeToken)
  if (res.status === 204 || !res.body) return null
  const session = await deriveSession({
    privateKey: p.privateKey,
    peerPublic: res.body.partnerPub,
    ownerPublic: p.ownerPublic,
    partnerPublic: res.body.partnerPub,
    mailboxId: p.mailboxId,
  })
  return { partnerName: res.body.partnerName || '', words: session.words, contentKey: session.contentKey }
}

export async function confirmOwnerPairing(p: OwnerPairing, c: PendingConfirm, scopes: PartnerScopes): Promise<void> {
  await putSecret('partner-owner-keys', { contentKey: c.contentKey, writeToken: p.writeToken })
  await writePartner({
    status: 'paired',
    partnerName: c.partnerName,
    ownerName: p.ownerName,
    relayUrl: p.relayUrl,
    mailboxId: p.mailboxId,
    scopes,
    version: 0,
    lastKey: null,
    lastUploadAt: null,
    lastUploadError: null,
    pairedAt: new Date().toISOString(),
  })
  await relay.deletePair(p.relayUrl, p.code, p.writeToken).catch(() => undefined)
}

export async function cancelOwnerPairing(p: OwnerPairing): Promise<void> {
  await relay.deletePair(p.relayUrl, p.code, p.writeToken).catch(() => undefined)
  await relay.revoke(p.relayUrl, p.mailboxId, p.writeToken).catch(() => undefined)
}

/** Owner revokes: wipes the relay copy and forgets the keys. */
export async function revokePartner(): Promise<void> {
  const state = await readPartner()
  const secrets = await getSecret('partner-owner-keys')
  if (state.status === 'paired' && secrets?.writeToken) {
    await relay.revoke(state.relayUrl, state.mailboxId, secrets.writeToken).catch(() => undefined)
    await recordTransfer('partner-revoke', hostOf(state.relayUrl), 0)
  }
  await clearPartner()
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

// ---------------------------------------------------------------------------
// Partner side
// ---------------------------------------------------------------------------

export function parsePairLink(url: string): { code: string; relayUrl: string } | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'meztli:' || (u.host !== 'pair' && !u.pathname.includes('pair'))) return null
    const code = normalizeCode(u.searchParams.get('c') ?? '')
    const relayUrl = u.searchParams.get('r') ?? ''
    return code.length === 6 ? { code, relayUrl } : null
  } catch {
    return null
  }
}

export async function joinAsPartner(relayUrl: string, rawCode: string, partnerName: string): Promise<string[]> {
  const code = normalizeCode(rawCode)
  const { body } = await relay.readPair(relayUrl, code)
  if (!body) throw new RelayError(404, 'not-found')
  const kp = await generateKeyPair()
  const session = await deriveSession({
    privateKey: kp.privateKey,
    peerPublic: body.offer.ownerPub,
    ownerPublic: body.offer.ownerPub,
    partnerPublic: kp.publicKey,
    mailboxId: body.mailboxId,
  })
  await relay.answer(relayUrl, code, kp.publicKey, partnerName)
  await putSecret('partner-viewer-keys', { contentKey: session.contentKey, readToken: body.offer.readToken })
  await writeViewer({
    status: 'pending',
    ownerName: body.offer.ownerName,
    words: session.words,
    relayUrl,
    mailboxId: body.mailboxId,
    lastVersion: 0,
    lastSnapshot: null,
    lastFetchedAt: null,
    lastFetchError: null,
    pairedAt: null,
  })
  return session.words
}

/** Pull the latest snapshot. Handles revocation and refuses rollbacks. */
export async function fetchSnapshot(): Promise<'updated' | 'unchanged' | 'revoked' | 'error'> {
  const v = await readViewer()
  const secrets = await getSecret('partner-viewer-keys')
  if ((v.status !== 'paired' && v.status !== 'pending') || !secrets?.readToken) return 'error'
  try {
    const res = await relay.get(v.relayUrl, v.mailboxId, secrets.readToken)
    if (res.status === 204 || !res.body) {
      await writeViewer({ lastFetchedAt: new Date().toISOString(), lastFetchError: null })
      return 'unchanged'
    }
    const box = res.body as SealedBox
    if (box.version < v.lastVersion) return 'unchanged'
    const snapshot = await open<PartnerSnapshot>(secrets.contentKey, v.mailboxId, box)
    await writeViewer({
      status: 'paired',
      pairedAt: v.pairedAt ?? new Date().toISOString(),
      words: [],
      ownerName: snapshot.ownerName || v.ownerName,
      lastVersion: box.version,
      lastSnapshot: snapshot,
      lastFetchedAt: new Date().toISOString(),
      lastFetchError: null,
    })
    return 'updated'
  } catch (e) {
    if (e instanceof RelayError && (e.status === 410 || (e.status === 404 && v.status === 'paired'))) {
      // Revoked: wipe the cached copy on contact (spec §5.7).
      await clearViewer()
      await writeViewer({ status: 'revoked', ownerName: v.ownerName })
      return 'revoked'
    }
    await writeViewer({ lastFetchError: e instanceof Error ? e.message : String(e) })
    return 'error'
  }
}

export { DEFAULT_SCOPES }
