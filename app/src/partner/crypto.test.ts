import { describe, expect, it } from 'vitest'
import { deriveSession, generateKeyPair, normalizeCode, open, pairingCode, PADDED_SIZE, SAS_WORDS, seal } from './crypto'

describe('partner crypto', () => {
  it('has 256 unique phrase words', () => {
    expect(SAS_WORDS).toHaveLength(256)
    expect(new Set(SAS_WORDS).size).toBe(256)
  })

  it('both sides derive the same key and words; a substituted key changes the words', async () => {
    const owner = await generateKeyPair()
    const partner = await generateKeyPair()
    const common = { ownerPublic: owner.publicKey, partnerPublic: partner.publicKey, mailboxId: 'box1' }
    const a = await deriveSession({ privateKey: owner.privateKey, peerPublic: partner.publicKey, ...common })
    const b = await deriveSession({ privateKey: partner.privateKey, peerPublic: owner.publicKey, ...common })
    expect(a).toEqual(b)
    expect(a.words).toHaveLength(4)

    const attacker = await generateKeyPair()
    const mitm = await deriveSession({
      privateKey: owner.privateKey,
      peerPublic: attacker.publicKey,
      ownerPublic: owner.publicKey,
      partnerPublic: attacker.publicKey,
      mailboxId: 'box1',
    })
    expect(mitm.words).not.toEqual(a.words)
  })

  it('seals to a fixed size and refuses a replay into another mailbox or version', async () => {
    const owner = await generateKeyPair()
    const partner = await generateKeyPair()
    const s = await deriveSession({
      privateKey: owner.privateKey,
      peerPublic: partner.publicKey,
      ownerPublic: owner.publicKey,
      partnerPublic: partner.publicKey,
      mailboxId: 'box1',
    })
    const small = await seal(s.contentKey, 'box1', 1, { a: 1 })
    const big = await seal(s.contentKey, 'box1', 2, { a: 'x'.repeat(2000) })
    expect(small.ct.length).toBe(big.ct.length)
    expect(await open(s.contentKey, 'box1', small)).toEqual({ a: 1 })
    await expect(open(s.contentKey, 'box2', small)).rejects.toBeTruthy()
    await expect(open(s.contentKey, 'box1', { ...small, version: 5 })).rejects.toBeTruthy()
    await expect(seal(s.contentKey, 'box1', 3, { a: 'x'.repeat(PADDED_SIZE) })).rejects.toThrow('snapshot-too-large')
  })

  it('pairing codes are 6 unambiguous characters', () => {
    for (let i = 0; i < 50; i++) expect(pairingCode()).toMatch(/^[A-HJKMNP-TV-Z2-9]{6}$/)
    expect(normalizeCode('7k4 · 2qd')).toBe('7K42QD')
  })
})
