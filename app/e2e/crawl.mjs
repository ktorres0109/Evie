// Crawls every screen of the owner app. For each control: fresh seeded app,
// replay the path to its screen, click, and compare a signature of
// (visible text, control states, open layers, whole database). A control that
// changes nothing is reported as possibly dead. Also collects page errors and
// runs axe on each screen.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { SHOTS, APP, RELAY } from './env.mjs'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const URL = APP
const LOCALE = process.argv[2] || 'en-US'
const SCENARIO = process.argv[3] || 'natural' // natural | pill
const MAX_DEPTH = Number(process.argv[4] || 3)
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const OUT = new URL(`./reports/crawl-${LOCALE}-${SCENARIO}.json`, import.meta.url).pathname

let browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

async function seed(page) {
  await page.evaluate(async (scenario) => {
    const { db, setSetting } = await import('/src/db/schema.ts')
    const { updatePrefs } = await import('/src/state/prefs.ts')
    const { addDays } = await import('/src/engine/cycle.ts')
    const iso = (d) => d.toISOString().slice(0, 10)
    const today = iso(new Date())
    const last = addDays(today, -13)
    let s = last
    const starts = []
    for (const l of [29, 31, 28, 29, 52]) { s = addDays(s, -l); starts.push(s) }
    for (const x of [...starts, last]) for (let i = 0; i < 5; i++)
      await db.dailyLogs.put({ date: addDays(x, i), flow: i < 2 ? 'medium' : 'light', checkInComplete: true, symptoms: i === 0 ? ['Cramps'] : [] })
    for (const x of starts) for (const d of [11, 12, 13])
      await db.dailyLogs.put({ date: addDays(x, d), checkInComplete: true, symptoms: ['Headache'], moods: ['calm'] })
    await db.lifeEvents.put({ id: 'seed-stress', kind: 'stress', startDate: addDays(last, -50), endDate: addDays(last, -40), createdAt: new Date().toISOString() })
    if (scenario === 'pill') {
      const start = addDays(today, -40)
      await db.regimenRecords.put({
        id: 'combined-pill-patch-ring-' + start, method: 'combined-pill-patch-ring', startDate: start,
        config: { kind: 'pill', activePillsPerPack: 21, placeboPillsPerPack: 7, schedule: 'standard', currentPackStart: addDays(today, -10) },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      })
    }
    await setSetting('onboarded', '1'); await setSetting('legal.accepted', JSON.stringify({ version: (await import('/src/content/legal.ts')).LEGAL_VERSION }))
    await updatePrefs({ role: 'owner' })
  }, SCENARIO)
}

async function fresh() {
  if (!browser.isConnected()) browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: LOCALE })
  const page = await ctx.newPage()
  page.errs = []
  page.external = 0
  page.on('pageerror', (e) => page.errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) page.errs.push('console: ' + m.text()) })
  page.on('download', () => page.external++)
  page.on('popup', () => page.external++)
  await page.addInitScript(() => {
    window.print = () => { window.__printed = (window.__printed || 0) + 1 }
    const open = window.open
    window.open = (...a) => { window.__opened = (window.__opened || 0) + 1; return null }
  })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await seed(page)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  return { ctx, page }
}

// Interactive controls in the top-most layer (last open dialog, else the page).
const CONTROLS = `button, [role=switch], [role=radio], [role=checkbox], [role=tab], a[href], select, input:not([type=hidden]), textarea`
async function controls(page) {
  return page.evaluate((SEL) => {
    const layers = [...document.querySelectorAll('[role=dialog]')]
    const root = layers.at(-1) || document.body
    const visible = (el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const name = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('name') || el.getAttribute('placeholder') || el.tagName + (el.type ? ':' + el.type : '')).trim().replace(/\s+/g, ' ').slice(0, 60)
    const out = []
    const seen = new Map()
    for (const el of root.querySelectorAll(SEL)) {
      if (!visible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') continue
      // The tab bar belongs to the page root only.
      if (layers.length && !root.contains(el)) continue
      const n = name(el)
      const k = seen.get(n) ?? 0
      seen.set(n, k + 1)
      out.push({ name: n, nth: k, tag: el.tagName.toLowerCase(), type: el.type || el.getAttribute('role') || '' })
    }
    return out
  }, CONTROLS)
}

async function locate(page, c) {
  const all = await page.evaluateHandle(({ SEL, c }) => {
    const layers = [...document.querySelectorAll('[role=dialog]')]
    const root = layers.at(-1) || document.body
    const name = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('name') || el.getAttribute('placeholder') || el.tagName + (el.type ? ':' + el.type : '')).trim().replace(/\s+/g, ' ').slice(0, 60)
    const matches = [...root.querySelectorAll(SEL)].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && !el.disabled && name(el) === c.name
    })
    return matches[c.nth] || null
  }, { SEL: CONTROLS, c })
  return all.asElement()
}

async function signature(page) {
  return page.evaluate(async () => {
    const { db } = await import('/src/db/schema.ts')
    const dump = {}
    for (const t of db.tables) dump[t.name] = await t.toArray()
    // Timestamps change on every write; keep them, writes are what we want to see.
    const states = [...document.querySelectorAll('[aria-pressed],[aria-checked],[aria-expanded],[aria-selected],input,select,textarea')]
      .map((el) => [el.getAttribute('aria-pressed'), el.getAttribute('aria-checked'), el.getAttribute('aria-expanded'), el.getAttribute('aria-selected'), el.value, el.checked].join('|')).join(';')
    return JSON.stringify({
      text: document.body.innerText,
      layers: document.querySelectorAll('[role=dialog]').length,
      states,
      db: JSON.stringify(dump),
      focus: document.activeElement?.outerHTML?.slice(0, 80),
      printed: window.__printed || 0,
      opened: window.__opened || 0,
      theme: document.documentElement.dataset.theme,
      lang: document.documentElement.lang,
    })
  })
}

async function act(page, el, c) {
  if (c.tag === 'select') {
    const vals = await el.evaluate((s) => [...s.options].map((o) => o.value).filter((v) => v !== s.value))
    if (vals.length) await el.selectOption(vals[0])
  } else if (c.tag === 'input' && c.type === 'date') {
    await el.fill(new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10))
  } else if (c.tag === 'input' && c.type === 'time') {
    await el.fill('08:30')
  } else if (c.tag === 'input' && c.type === 'file') {
    return 'skipped-file'
  } else if ((c.tag === 'input' && !['checkbox', 'radio'].includes(c.type)) || c.tag === 'textarea') {
    await el.fill(c.type === 'number' ? '36.6' : 'Test 123')
  } else {
    await el.click({ timeout: 3000 })
  }
  await page.waitForTimeout(450)
  return 'ok'
}

async function replay(page, path) {
  for (const step of path) {
    const el = await locate(page, step)
    if (!el) throw new Error('replay: lost control ' + step.name)
    await act(page, el, step)
  }
}

const MONTHS = /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/gi
const norm = (x) => x.replace(MONTHS, '').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim()
async function screenKey(page) {
  return norm(await page.evaluate(() => {
    const layers = [...document.querySelectorAll('[role=dialog]')]
    const top = layers.at(-1)
    if (top) return 'dialog:' + (top.getAttribute('aria-label') || top.querySelector('h1,h2')?.innerText || '?')
    const h = document.querySelector('.mz-tab[aria-current=page], .mz-tab[aria-selected=true]')
    return 'tab:' + (h?.getAttribute('aria-label') || document.querySelector('h1')?.innerText || '?')
  }))
}

const report = { dead: [], errors: [], axe: {}, screens: [], replayFailures: [] }
const visited = new Set()
const queue = []

// Root screens: each tab.
{
  const { ctx, page } = await fresh()
  const tabs = (await controls(page)).filter((c) => /tab \d/i.test(c.name) || /pestaña \d/i.test(c.name))
  for (const t of tabs) queue.push({ path: [t], depth: 1 })
  await ctx.close()
}

let clicks = 0
while (queue.length) {
  const { path, depth } = queue.shift()
  const { ctx, page } = await fresh()
  try {
    await replay(page, path)
  } catch (e) {
    report.replayFailures.push({ path: path.map((p) => p.name), error: String(e.message) })
    await ctx.close()
    continue
  }
  const key = await screenKey(page)
  if (visited.has(key)) { await ctx.close(); continue }
  visited.add(key)
  report.screens.push({ key, path: path.map((p) => p.name) })
  // Accessibility scan of this screen.
  await page.addScriptTag({ content: AXE })
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) }))
  })
  if (axe.length) report.axe[key] = axe
  const all = await controls(page)
  const per = new Map()
  const list = all.filter((c) => { const k = norm(c.name) + c.tag; const n = per.get(k) ?? 0; per.set(k, n + 1); return n < 2 })
  await ctx.close()
  console.log(`[${key}] ${list.length} controls (queue ${queue.length})`)

  for (const c of list) {
    if (depth > 1 && /tab \d|pestaña \d/i.test(c.name)) continue
    const { ctx, page } = await fresh()
    try {
      await replay(page, path)
      const before = await signature(page)
      const beforeLayers = await page.evaluate(() => document.querySelectorAll('[role=dialog]').length)
      const el = await locate(page, c)
      if (!el) { report.replayFailures.push({ path: [...path.map((p) => p.name), c.name], error: 'control vanished' }); continue }
      const errsBefore = page.errs.length
      const r = await act(page, el, c)
      clicks++
      const after = await signature(page)
      const afterLayers = await page.evaluate(() => document.querySelectorAll('[role=dialog]').length)
      if (page.errs.length > errsBefore) report.errors.push({ at: key, control: c.name, errors: page.errs.slice(errsBefore) })
      if (r === 'ok' && before === after && page.external === 0)
        report.dead.push({ at: key, control: c.name, tag: c.tag, type: c.type })
      const newKey = await screenKey(page)
      if (depth < MAX_DEPTH && (afterLayers > beforeLayers || newKey !== key) && !visited.has(newKey))
        queue.push({ path: [...path, c], depth: depth + 1 })
    } catch (e) {
      report.errors.push({ at: key, control: c.name, errors: ['crawler: ' + String(e.message).split('\n')[0]] })
    } finally {
      await ctx.close()
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1))
}
fs.writeFileSync(OUT, JSON.stringify(report, null, 1))
console.log(`done: ${report.screens.length} screens, ${clicks} actions, ${report.dead.length} no-effect, ${report.errors.length} errors, axe on ${Object.keys(report.axe).length} screens`)
await browser.close()
