// Simulates Android's system font size (WebView text zoom) by scaling every
// computed font size and line height, then screenshots the main screens.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { SHOTS, APP, RELAY } from './env.mjs'
import fs from 'node:fs'
const OUT = SHOTS
const SCALE = Number(process.argv[2] || 1.5)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1.5, locale: 'es-MX' })).newPage()
await p.goto(APP, { waitUntil: 'networkidle' })
await p.evaluate(async () => {
  const { db, setSetting } = await import('/src/db/schema.ts'); const { updatePrefs } = await import('/src/state/prefs.ts'); const { addDays } = await import('/src/engine/cycle.ts')
  const last = addDays(new Date().toISOString().slice(0, 10), -13); let s = last; const st = []
  for (const l of [29, 31, 28, 29]) { s = addDays(s, -l); st.push(s) }
  for (const x of [...st, last]) for (let i = 0; i < 5; i++) await db.dailyLogs.put({ date: addDays(x, i), flow: 'medium', checkInComplete: true, symptoms: i ? [] : ['Cramps'] })
  await setSetting('onboarded', '1'); await setSetting('legal.accepted', JSON.stringify({ version: (await import('/src/content/legal.ts')).LEGAL_VERSION })); await updatePrefs({ role: 'owner' })
})
await p.reload({ waitUntil: 'networkidle' })
const scale = async () => p.evaluate((k) => {
  // Measure every new element first, then scale, so inherited sizes are not scaled twice.
  const apply = () => {
    const fresh = [...document.querySelectorAll('body *')].filter((el) => !el.dataset.z)
    const sizes = fresh.map((el) => { const cs = getComputedStyle(el); return [parseFloat(cs.fontSize), cs.lineHeight] })
    fresh.forEach((el, i) => {
      const [fs, lh] = sizes[i]
      el.style.setProperty('font-size', fs * k + 'px', 'important')
      if (lh.endsWith('px')) el.style.setProperty('line-height', parseFloat(lh) * k + 'px', 'important')
      el.dataset.z = '1'
    })
  }
  apply()
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true })
}, SCALE)
await scale()
const tabs = p.locator('nav button')
const overflow = () => p.evaluate(() => {
  const bad = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'hidden' && el.innerText?.trim()) bad.push((el.className || el.tagName) + ': ' + el.innerText.trim().slice(0, 40))
    const r = el.getBoundingClientRect()
    if (r.right > innerWidth + 1 && r.width > 0 && el.children.length === 0 && el.innerText?.trim()) bad.push('offscreen ' + (el.className || el.tagName) + ': ' + el.innerText.trim().slice(0, 40))
  }
  return [...new Set(bad)].slice(0, 12)
})
for (const [i, n] of [[0, 'today'], [1, 'calendar'], [3, 'insights'], [4, 'you']]) {
  await tabs.nth(i).click(); await p.waitForTimeout(600)
  await p.screenshot({ path: `${OUT}/big-${SCALE}-${n}.png` })
  console.log(n, JSON.stringify(await overflow()))
}
await tabs.nth(2).click(); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/big-${SCALE}-log.png` })
console.log('log', JSON.stringify(await overflow()))
await b.close()
