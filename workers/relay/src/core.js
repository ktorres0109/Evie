/**
 * Relay logic, independent of Cloudflare so it can be unit-tested.
 *
 * Two record kinds, each living in its own Durable Object instance:
 *   pair:<code>   short-lived pairing offer/answer (3 minutes, single read)
 *   box:<id>      one encrypted snapshot with a monotonic version
 *
 * Tokens are never stored, only their SHA-256. Blobs are opaque.
 */

export const PAIR_TTL_MS = 3 * 60 * 1000
export const BOX_IDLE_TTL_MS = 60 * 24 * 60 * 60 * 1000
export const MAX_BODY = 12 * 1024

const CODE_RE = /^[A-HJKMNP-TV-Z2-9]{6}$/
const ID_RE = /^[A-Za-z0-9_-]{16,64}$/

export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  let s = ''
  for (const b of new Uint8Array(digest)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function json(status, body) {
  return { status, body }
}

function bearer(headers) {
  const h = headers.get('authorization') || ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

async function authorized(headers, hash) {
  const token = bearer(headers)
  return Boolean(token && hash && (await sha256(token)) === hash)
}

/** Pairing record: `store` is the storage of the pair:<code> object. */
export async function handlePair(method, sub, headers, body, store, now) {
  const rec = await store.get('rec')
  const expired = rec && rec.expiresAt < now
  if (method === 'POST' && sub === '') {
    if (rec && !expired) return json(409, { error: 'code-in-use' })
    const b = body || {}
    if (!ID_RE.test(b.mailboxId || '') || !b.writeHash || !b.offer || typeof b.offer.ownerPub !== 'string') {
      return json(400, { error: 'bad-request' })
    }
    await store.put('rec', {
      mailboxId: b.mailboxId,
      writeHash: b.writeHash,
      offer: { ownerPub: b.offer.ownerPub, ownerName: String(b.offer.ownerName || '').slice(0, 40), readToken: String(b.offer.readToken || '') },
      consumed: false,
      answer: null,
      expiresAt: now + PAIR_TTL_MS,
    })
    await store.setAlarm(now + PAIR_TTL_MS + 60_000)
    return json(201, { expiresAt: now + PAIR_TTL_MS })
  }
  if (!rec || expired) return json(404, { error: 'not-found' })

  if (method === 'GET' && sub === '') {
    // Single use: the first read consumes the code.
    if (rec.consumed) return json(410, { error: 'used' })
    rec.consumed = true
    await store.put('rec', rec)
    return json(200, { mailboxId: rec.mailboxId, offer: rec.offer })
  }
  if (method === 'POST' && sub === 'answer') {
    if (!rec.consumed || rec.answer) return json(409, { error: 'no-answer-expected' })
    const b = body || {}
    if (typeof b.partnerPub !== 'string') return json(400, { error: 'bad-request' })
    rec.answer = { partnerPub: b.partnerPub, partnerName: String(b.partnerName || '').slice(0, 40) }
    await store.put('rec', rec)
    return json(201, {})
  }
  if (method === 'GET' && sub === 'answer') {
    if (!(await authorized(headers, rec.writeHash))) return json(401, { error: 'unauthorized' })
    return rec.answer ? json(200, rec.answer) : json(204, null)
  }
  if (method === 'DELETE' && sub === '') {
    if (!(await authorized(headers, rec.writeHash))) return json(401, { error: 'unauthorized' })
    await store.deleteAll()
    return json(204, null)
  }
  return json(405, { error: 'method' })
}

/** Mailbox record: `store` is the storage of the box:<id> object. */
export async function handleBox(method, headers, body, store, now) {
  const rec = await store.get('rec')
  if (method === 'POST') {
    // Create (owner, during pairing). Idempotent for the same write token.
    const b = body || {}
    if (!b.writeHash || !b.readHash) return json(400, { error: 'bad-request' })
    if (rec && rec.writeHash !== b.writeHash) return json(409, { error: 'exists' })
    if (!rec) await store.put('rec', { writeHash: b.writeHash, readHash: b.readHash, version: 0, box: null, revoked: false, touchedAt: now })
    await store.setAlarm(now + BOX_IDLE_TTL_MS)
    return json(201, {})
  }
  if (!rec) return json(404, { error: 'not-found' })

  if (method === 'PUT') {
    if (!(await authorized(headers, rec.writeHash))) return json(401, { error: 'unauthorized' })
    if (rec.revoked) return json(410, { error: 'revoked' })
    const b = body || {}
    if (!Number.isInteger(b.version) || typeof b.nonce !== 'string' || typeof b.ct !== 'string') return json(400, { error: 'bad-request' })
    if (b.version <= rec.version) return json(409, { error: 'stale-version', version: rec.version })
    rec.version = b.version
    rec.box = { version: b.version, nonce: b.nonce, ct: b.ct }
    rec.touchedAt = now
    await store.put('rec', rec)
    await store.setAlarm(now + BOX_IDLE_TTL_MS)
    return json(200, { version: rec.version })
  }
  if (method === 'GET') {
    if (!(await authorized(headers, rec.readHash))) return json(401, { error: 'unauthorized' })
    if (rec.revoked) return json(410, { error: 'revoked' })
    return rec.box ? json(200, rec.box) : json(204, null)
  }
  if (method === 'DELETE') {
    if (!(await authorized(headers, rec.writeHash))) return json(401, { error: 'unauthorized' })
    // Keep a tombstone so the partner app learns it was revoked and wipes its copy.
    await store.put('rec', { ...rec, box: null, revoked: true, touchedAt: now })
    await store.setAlarm(now + BOX_IDLE_TTL_MS)
    return json(204, null)
  }
  return json(405, { error: 'method' })
}

export function route(pathname) {
  const m = pathname.match(/^\/v1\/(pair|box)\/([^/]+)(?:\/(answer))?\/?$/)
  if (!m) return null
  const [, kind, id, sub] = m
  if (kind === 'pair' && !CODE_RE.test(id)) return null
  if (kind === 'box' && !ID_RE.test(id)) return null
  return { kind, id, sub: sub || '' }
}
