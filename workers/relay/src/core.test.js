import { describe, expect, it } from 'vitest'
import { PAIR_TTL_MS, handleBox, handlePair, route, sha256 } from './core.js'

function memoryStore() {
  const map = new Map()
  return {
    map,
    get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined),
    put: async (k, v) => void map.set(k, structuredClone(v)),
    deleteAll: async () => map.clear(),
    setAlarm: async () => undefined,
  }
}

const auth = (token) => new Headers(token ? { authorization: `Bearer ${token}` } : {})

describe('route', () => {
  it('accepts only well-formed codes and ids', () => {
    expect(route('/v1/pair/7K42QD')).toEqual({ kind: 'pair', id: '7K42QD', sub: '' })
    expect(route('/v1/pair/7K42QD/answer')).toEqual({ kind: 'pair', id: '7K42QD', sub: 'answer' })
    expect(route('/v1/pair/ABC')).toBeNull()
    expect(route('/v1/pair/0OIL11')).toBeNull()
    expect(route('/v1/box/' + 'a'.repeat(22))).toMatchObject({ kind: 'box' })
    expect(route('/v1/box/short')).toBeNull()
  })
})

describe('pairing', () => {
  it('offer → single read → answer → owner fetches answer', async () => {
    const store = memoryStore()
    const writeHash = await sha256('w')
    const offer = { ownerPub: 'PUB', ownerName: 'Jas', readToken: 'r' }
    expect((await handlePair('POST', '', auth(), { mailboxId: 'm'.repeat(22), writeHash, offer }, store, 0)).status).toBe(201)
    expect((await handlePair('POST', '', auth(), { mailboxId: 'm'.repeat(22), writeHash, offer }, store, 1)).status).toBe(409)
    const read = await handlePair('GET', '', auth(), null, store, 2)
    expect(read.status).toBe(200)
    expect(read.body.offer.ownerPub).toBe('PUB')
    expect((await handlePair('GET', '', auth(), null, store, 3)).status).toBe(410)
    expect((await handlePair('GET', 'answer', auth('w'), null, store, 4)).status).toBe(204)
    expect((await handlePair('POST', 'answer', auth(), { partnerPub: 'P2', partnerName: 'Kelvin' }, store, 5)).status).toBe(201)
    expect((await handlePair('POST', 'answer', auth(), { partnerPub: 'P3' }, store, 6)).status).toBe(409)
    expect((await handlePair('GET', 'answer', auth('nope'), null, store, 7)).status).toBe(401)
    const ans = await handlePair('GET', 'answer', auth('w'), null, store, 8)
    expect(ans.body).toEqual({ partnerPub: 'P2', partnerName: 'Kelvin' })
  })

  it('codes expire after three minutes', async () => {
    const store = memoryStore()
    await handlePair('POST', '', auth(), { mailboxId: 'm'.repeat(22), writeHash: 'h', offer: { ownerPub: 'x' } }, store, 0)
    expect((await handlePair('GET', '', auth(), null, store, PAIR_TTL_MS + 1)).status).toBe(404)
  })
})

describe('mailbox', () => {
  it('enforces tokens and monotonic versions, and leaves a tombstone on revoke', async () => {
    const store = memoryStore()
    const writeHash = await sha256('w')
    const readHash = await sha256('r')
    expect((await handleBox('POST', auth(), { writeHash, readHash }, store, 0)).status).toBe(201)
    expect((await handleBox('GET', auth('r'), null, store, 1)).status).toBe(204)
    expect((await handleBox('PUT', auth('r'), { version: 1, nonce: 'n', ct: 'c' }, store, 2)).status).toBe(401)
    expect((await handleBox('PUT', auth('w'), { version: 1, nonce: 'n', ct: 'c' }, store, 3)).status).toBe(200)
    expect((await handleBox('PUT', auth('w'), { version: 1, nonce: 'n', ct: 'c2' }, store, 4)).status).toBe(409)
    expect((await handleBox('GET', auth('w'), null, store, 5)).status).toBe(401)
    expect((await handleBox('GET', auth('r'), null, store, 6)).body).toEqual({ version: 1, nonce: 'n', ct: 'c' })
    expect((await handleBox('DELETE', auth('r'), null, store, 7)).status).toBe(401)
    expect((await handleBox('DELETE', auth('w'), null, store, 8)).status).toBe(204)
    expect((await handleBox('GET', auth('r'), null, store, 9)).status).toBe(410)
    expect(JSON.stringify(store.map.get('rec'))).not.toContain('"ct":"c"')
  })
})
