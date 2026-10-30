/**
 * Cloudflare entry point: routes each request to the Durable Object that owns
 * that code or mailbox. No logging, no analytics, no accounts.
 */
import { BOX_IDLE_TTL_MS, MAX_BODY, handleBox, handlePair, route } from './core.js'

function cors(request, env) {
  const origin = request.headers.get('origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim())
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] || '*',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

export default {
  async fetch(request, env) {
    const headers = cors(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const url = new URL(request.url)
    if (url.pathname === '/' || url.pathname === '/v1/health') {
      return new Response(JSON.stringify({ ok: true, service: 'meztli-relay' }), { headers: { ...headers, 'content-type': 'application/json' } })
    }
    const r = route(url.pathname)
    if (!r) return new Response('{"error":"not-found"}', { status: 404, headers })
    const length = Number(request.headers.get('content-length') || 0)
    if (length > MAX_BODY) return new Response('{"error":"too-large"}', { status: 413, headers })
    const stub = env.BOXES.get(env.BOXES.idFromName(`${r.kind}:${r.id}`))
    const res = await stub.fetch(new Request(`https://do/${r.kind}/${r.sub}`, request))
    const out = new Response(res.body, res)
    for (const [k, v] of Object.entries(headers)) out.headers.set(k, v)
    return out
  },
}

export class Box {
  constructor(ctx) {
    this.ctx = ctx
    const storage = ctx.storage
    this.store = {
      get: (k) => storage.get(k),
      put: (k, v) => storage.put(k, v),
      deleteAll: () => storage.deleteAll(),
      setAlarm: (t) => storage.setAlarm(t),
    }
  }

  async fetch(request) {
    const url = new URL(request.url)
    const [, kind, sub = ''] = url.pathname.split('/')
    let body = null
    if (request.method === 'POST' || request.method === 'PUT') {
      const text = await request.text()
      if (text.length > MAX_BODY) return new Response('{"error":"too-large"}', { status: 413 })
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        return new Response('{"error":"bad-json"}', { status: 400 })
      }
    }
    const now = Date.now()
    const result =
      kind === 'pair'
        ? await handlePair(request.method, sub, request.headers, body, this.store, now)
        : await handleBox(request.method, request.headers, body, this.store, now)
    return new Response(result.body === null ? null : JSON.stringify(result.body), {
      status: result.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  }

  /** Expiry: pairing codes after 3 minutes, idle mailboxes after 60 days. */
  async alarm() {
    const rec = await this.ctx.storage.get('rec')
    const now = Date.now()
    if (!rec) return
    if (rec.expiresAt !== undefined && rec.expiresAt < now) return this.ctx.storage.deleteAll()
    if (rec.touchedAt !== undefined && rec.touchedAt + BOX_IDLE_TTL_MS <= now) return this.ctx.storage.deleteAll()
  }
}
