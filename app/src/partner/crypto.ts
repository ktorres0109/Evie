/**
 * End-to-end encryption for partner sharing.
 *
 *  - X25519 key agreement (WebCrypto; Android WebView ≥ 133, iOS ≥ 18.4).
 *  - HKDF-SHA-256 derives the content key and a short authentication string.
 *  - AES-256-GCM encrypts each snapshot; the mailbox id and version are bound
 *    as additional data so a blob cannot be replayed into another mailbox or
 *    rolled back.
 *  - Plaintext is padded to a fixed size so the relay cannot learn anything
 *    from length.
 *
 * The 4-word phrase is derived from the shared secret and both public keys;
 * if anyone in the middle substituted a key, the two phones show different
 * words. The owner confirms the match before anything is shared.
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

export const PADDED_SIZE = 4096

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('crypto-unavailable')
  return s
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(n)
  globalThis.crypto.getRandomValues(out)
  return out
}

export function b64url(bytes: Uint8Array | ArrayBuffer): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of u8) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const pad = text.length % 4 ? '='.repeat(4 - (text.length % 4)) : ''
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function supportsX25519(): Promise<boolean> {
  try {
    await subtle().generateKey({ name: 'X25519' }, true, ['deriveBits'])
    return true
  } catch {
    return false
  }
}

export interface KeyPair {
  publicKey: string
  /** PKCS#8, base64url. Stored only in the secure vault during pairing. */
  privateKey: string
}

export async function generateKeyPair(): Promise<KeyPair> {
  const kp = (await subtle().generateKey({ name: 'X25519' }, true, ['deriveBits'])) as CryptoKeyPair
  const pub = await subtle().exportKey('raw', kp.publicKey)
  const priv = await subtle().exportKey('pkcs8', kp.privateKey)
  return { publicKey: b64url(pub), privateKey: b64url(priv) }
}

async function sharedSecret(privateKey: string, peerPublic: string): Promise<Uint8Array<ArrayBuffer>> {
  const priv = await subtle().importKey('pkcs8', fromB64url(privateKey), { name: 'X25519' }, false, ['deriveBits'])
  const pub = await subtle().importKey('raw', fromB64url(peerPublic), { name: 'X25519' }, false, [])
  return new Uint8Array(await subtle().deriveBits({ name: 'X25519', public: pub }, priv, 256))
}

async function hkdf(ikm: Uint8Array<ArrayBuffer>, salt: string, info: string, bytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(
    await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode(info) }, key, bytes * 8),
  )
}

export interface Session {
  /** AES-256-GCM key, base64url. */
  contentKey: string
  /** Four words both phones must show identically. */
  words: string[]
}

/**
 * Both sides call this with their own private key and the other's public key.
 * `ownerPublic` and `partnerPublic` are passed explicitly so both compute the
 * same transcript regardless of which side they are.
 */
export async function deriveSession(args: {
  privateKey: string
  peerPublic: string
  ownerPublic: string
  partnerPublic: string
  mailboxId: string
}): Promise<Session> {
  const secret = await sharedSecret(args.privateKey, args.peerPublic)
  const transcript = `meztli-pair-v1|${args.mailboxId}|${args.ownerPublic}|${args.partnerPublic}`
  const content = await hkdf(secret, transcript, 'content-v1', 32)
  const sas = await hkdf(secret, transcript, 'sas-v1', 4)
  return { contentKey: b64url(content), words: [...sas].map((b) => SAS_WORDS[b]) }
}

function aad(mailboxId: string, version: number): Uint8Array<ArrayBuffer> {
  return enc.encode(`${mailboxId}|${version}`)
}

export interface SealedBox {
  version: number
  nonce: string
  ct: string
}

export async function seal(contentKey: string, mailboxId: string, version: number, payload: unknown): Promise<SealedBox> {
  const json = enc.encode(JSON.stringify(payload))
  if (json.length + 4 > PADDED_SIZE) throw new Error('snapshot-too-large')
  // [4-byte length][json][zero padding] → always PADDED_SIZE bytes.
  const plain = new Uint8Array(PADDED_SIZE)
  new DataView(plain.buffer).setUint32(0, json.length)
  plain.set(json, 4)
  const key = await subtle().importKey('raw', fromB64url(contentKey), 'AES-GCM', false, ['encrypt'])
  const nonce = randomBytes(12)
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(mailboxId, version) }, key, plain)
  return { version, nonce: b64url(nonce), ct: b64url(ct) }
}

export async function open<T>(contentKey: string, mailboxId: string, box: SealedBox): Promise<T> {
  const key = await subtle().importKey('raw', fromB64url(contentKey), 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(
    await subtle().decrypt(
      { name: 'AES-GCM', iv: fromB64url(box.nonce), additionalData: aad(mailboxId, box.version) },
      key,
      fromB64url(box.ct),
    ),
  )
  const length = new DataView(plain.buffer).getUint32(0)
  return JSON.parse(dec.decode(plain.subarray(4, 4 + length))) as T
}

export async function sha256(text: string): Promise<string> {
  return b64url(await subtle().digest('SHA-256', enc.encode(text)))
}

/** Six characters, no 0/O/1/I/L/U to misread or say aloud wrongly. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
export function pairingCode(): string {
  const bytes = randomBytes(6)
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}

/**
 * 256 short, concrete, easy-to-say words. The same list on every phone in
 * every language, so the phrase matches whatever language each phone uses.
 */
export const SAS_WORDS: readonly string[] = [
  'acorn', 'amber', 'anchor', 'apple', 'arrow', 'aspen', 'atlas', 'badge', 'bagel', 'balloon', 'bamboo', 'banjo',
  'barn', 'basil', 'beach', 'beacon', 'bean', 'bear', 'bee', 'bell', 'berry', 'bike', 'birch', 'bird',
  'biscuit', 'blanket', 'bloom', 'boat', 'bone', 'book', 'boot', 'bottle', 'bowl', 'brick', 'bridge', 'brook',
  'brush', 'bubble', 'bucket', 'butter', 'button', 'cabin', 'cactus', 'cake', 'camel', 'candle', 'canoe', 'canyon',
  'cape', 'carrot', 'castle', 'cedar', 'cello', 'chalk', 'cherry', 'chess', 'cider', 'cliff', 'clock', 'cloud',
  'clover', 'coast', 'cocoa', 'coin', 'comet', 'coral', 'cotton', 'crab', 'crane', 'crayon', 'creek', 'cricket',
  'crown', 'cub', 'cup', 'daisy', 'dawn', 'deer', 'desert', 'dew', 'dolphin', 'dove', 'dragon', 'drum',
  'duck', 'dune', 'eagle', 'echo', 'elm', 'ember', 'falcon', 'fern', 'fig', 'finch', 'fjord', 'flame',
  'flute', 'fog', 'forest', 'fox', 'frog', 'frost', 'garden', 'gecko', 'ginger', 'glacier', 'globe', 'goat',
  'grape', 'gravel', 'gull', 'harbor', 'harp', 'hawk', 'hazel', 'heron', 'hill', 'honey', 'horse', 'iris',
  'island', 'ivy', 'jade', 'jam', 'jelly', 'kayak', 'kettle', 'kite', 'koala', 'lagoon', 'lamp', 'lantern',
  'lark', 'lava', 'leaf', 'lemon', 'lily', 'lime', 'lion', 'llama', 'lotus', 'lynx', 'mango', 'maple',
  'marble', 'meadow', 'melon', 'mint', 'mirror', 'mist', 'mitten', 'moon', 'moss', 'moth', 'mountain', 'mouse',
  'mug', 'nest', 'nickel', 'noodle', 'nutmeg', 'oak', 'oasis', 'ocean', 'olive', 'onion', 'opal', 'orange',
  'orchid', 'otter', 'owl', 'paddle', 'panda', 'paper', 'parrot', 'peach', 'pear', 'pebble', 'pecan', 'pelican',
  'penguin', 'pepper', 'piano', 'pillow', 'pine', 'planet', 'plum', 'pond', 'poppy', 'puffin', 'pumpkin', 'quail',
  'quilt', 'rabbit', 'radish', 'rain', 'raven', 'reef', 'river', 'robin', 'rocket', 'rose', 'ruby', 'saddle',
  'sage', 'sail', 'salmon', 'sand', 'seal', 'seed', 'shell', 'ship', 'silver', 'sky', 'sled', 'snail',
  'snow', 'sock', 'sparrow', 'spoon', 'spruce', 'squid', 'star', 'stone', 'storm', 'straw', 'sugar', 'sun',
  'swan', 'tea', 'thistle', 'thunder', 'tiger', 'toast', 'tomato', 'torch', 'tulip', 'turtle', 'umbrella', 'valley',
  'velvet', 'violet', 'walnut', 'wave', 'whale', 'wheat', 'willow', 'window', 'wolf', 'wren', 'yarn', 'zebra',
  'zinc', 'meteor', 'nectar', 'pine-cone',
]
