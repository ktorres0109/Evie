import http from 'node:http'
// Local stand-in for the Cloudflare relay, for development and browser tests.
// Same request handling as the Worker (src/core.js), in-memory storage, open CORS.
// Run: node workers/relay/dev-server.mjs  → http://localhost:8787
import { handleBox, handlePair, route } from './src/core.js'
const stores = new Map()
function store(name) {
  if (!stores.has(name)) {
    const map = new Map()
    stores.set(name, { get: async (k) => structuredClone(map.get(k)), put: async (k, v) => void map.set(k, structuredClone(v)), deleteAll: async () => map.clear(), setAlarm: async () => {} })
  }
  return stores.get(name)
}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'authorization,content-type' }
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/v1/health') { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); return res.end('{"ok":true}') }
  const r = route(url.pathname)
  if (!r) { res.writeHead(404, cors); return res.end('{"error":"not-found"}') }
  let text = ''; for await (const c of req) text += c
  const body = text ? JSON.parse(text) : null
  const headers = new Headers(Object.entries(req.headers).map(([k, v]) => [k, String(v)]))
  const s = store(`${r.kind}:${r.id}`)
  const out = r.kind === 'pair' ? await handlePair(req.method, r.sub, headers, body, s, Date.now()) : await handleBox(req.method, headers, body, s, Date.now())
  res.writeHead(out.status, { ...cors, 'content-type': 'application/json' })
  res.end(out.body === null ? '' : JSON.stringify(out.body))
}).listen(Number(process.env.PORT || 8787), () => console.log('relay on', process.env.PORT || 8787))
