/** Thin HTTP client for the partner relay (workers/relay). */
import type { SealedBox } from './crypto'

export const DEFAULT_RELAY_URL: string = (import.meta.env.VITE_RELAY_URL as string | undefined) ?? ''

export class RelayError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

async function call<T>(base: string, path: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: T | null }> {
  if (!base) throw new RelayError(0, 'no-relay')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.token) headers.authorization = `Bearer ${init.token}`
  let res: Response
  try {
    res = await fetch(base.replace(/\/$/, '') + path, { ...init, headers, cache: 'no-store' })
  } catch {
    throw new RelayError(0, 'offline')
  }
  const text = await res.text()
  const body = text ? (JSON.parse(text) as T) : null
  if (res.status >= 400) throw new RelayError(res.status, (body as { error?: string } | null)?.error ?? `http-${res.status}`)
  return { status: res.status, body }
}

export interface Offer {
  ownerPub: string
  ownerName: string
  readToken: string
}

export const relay = {
  health: (base: string) => call<{ ok: boolean }>(base, '/v1/health'),
  createBox: (base: string, id: string, writeHash: string, readHash: string) =>
    call(base, `/v1/box/${id}`, { method: 'POST', body: JSON.stringify({ writeHash, readHash }) }),
  createPair: (base: string, code: string, mailboxId: string, writeHash: string, offer: Offer) =>
    call(base, `/v1/pair/${code}`, { method: 'POST', body: JSON.stringify({ mailboxId, writeHash, offer }) }),
  readPair: (base: string, code: string) => call<{ mailboxId: string; offer: Offer }>(base, `/v1/pair/${code}`),
  answer: (base: string, code: string, partnerPub: string, partnerName: string) =>
    call(base, `/v1/pair/${code}/answer`, { method: 'POST', body: JSON.stringify({ partnerPub, partnerName }) }),
  readAnswer: (base: string, code: string, writeToken: string) =>
    call<{ partnerPub: string; partnerName: string }>(base, `/v1/pair/${code}/answer`, { token: writeToken }),
  deletePair: (base: string, code: string, writeToken: string) => call(base, `/v1/pair/${code}`, { method: 'DELETE', token: writeToken }),
  put: (base: string, id: string, writeToken: string, box: SealedBox) =>
    call<{ version: number }>(base, `/v1/box/${id}`, { method: 'PUT', token: writeToken, body: JSON.stringify(box) }),
  get: (base: string, id: string, readToken: string) => call<SealedBox>(base, `/v1/box/${id}`, { token: readToken }),
  revoke: (base: string, id: string, writeToken: string) => call(base, `/v1/box/${id}`, { method: 'DELETE', token: writeToken }),
}
