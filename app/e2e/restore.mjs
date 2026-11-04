import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { SHOTS, APP, RELAY } from './env.mjs'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
const OUT = SHOTS
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const locale = process.argv[2] || 'en-US'
const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale })).newPage()
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await p.goto(APP, { waitUntil: 'networkidle' })
const primary = () => p.locator('.mz-btn--primary').last().click()
await p.locator('button').filter({ hasText: /^(Me|Mío)/ }).first().click()
for (const c of await p.getByRole('checkbox').all()) await c.check(); await primary(); await primary()
await p.locator('input[type=date]').fill(new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10)); await primary()
await p.locator('.mz-btn--ghost').last().click(); await primary(); await p.locator('.mz-btn--ghost').last().click()
await p.evaluate(async () => {
  const { db } = await import('/src/db/schema.ts'); const { addDays } = await import('/src/engine/cycle.ts')
  const iso = (d) => d.toISOString().slice(0, 10); const last = addDays(iso(new Date()), -13)
  let s = last; const st = []
  for (const l of [29, 31, 28, 29, 52]) { s = addDays(s, -l); st.push(s) }
  for (const x of [...st, last]) for (let i = 0; i < 5; i++) await db.dailyLogs.put({ date: addDays(x, i), flow: i === 1 ? 'heavy' : i < 2 ? 'medium' : 'light', checkInComplete: true, symptoms: i === 0 ? ['Cramps'] : [], symptomRatings: i === 0 ? { Cramps: { severity: 'severe' } } : undefined, moods: ['low'] })
  for (const x of st) for (const d of [11, 12, 13]) await db.dailyLogs.put({ date: addDays(x, d), checkInComplete: true, symptoms: ['Headache'], spotting: d === 12 })
  await db.lifeEvents.put({ id: 'e1', kind: 'stress', startDate: addDays(last, -60), endDate: addDays(last, -40), createdAt: new Date().toISOString() })
  await db.lifeEvents.put({ id: 'e2', kind: 'pregnancy-ended', startDate: addDays(last, -400), createdAt: new Date().toISOString() })
})

const plain = await p.evaluate(async () => JSON.stringify(await (await import('/src/db/transfer.ts')).collectExport()))
const locked = await p.evaluate(async () => JSON.stringify(await (await import('/src/db/transfer.ts')).encryptedExport('correct horse')))

fs.writeFileSync(path.join(os.tmpdir(), 'meztli-plain.json'), plain); fs.writeFileSync(path.join(os.tmpdir(), 'meztli-locked.json'), locked)
await p.evaluate(async () => { const { db } = await import('/src/db/schema.ts'); await db.dailyLogs.clear() })
const count = () => p.evaluate(async () => (await import('/src/db/schema.ts')).db.dailyLogs.count())
console.log('after wipe', await count())
await p.locator('nav button').nth(4).click()
await p.locator('.mz-list-row').filter({ hasText: /Privacy|Privacidad/ }).first().click()
const restore = async (file, pass) => {
  await p.locator('.mz-list-row').filter({ hasText: /Restore|Restaurar/ }).first().click()
  await p.locator('input[type=file]').setInputFiles(file)
  if (pass !== undefined) await p.locator('input[type=password]').fill(pass)
  await p.locator('.mz-sheet .mz-btn--primary, [role=dialog] .mz-btn--primary').last().click()
  await p.waitForTimeout(600)
  const msg = await p.locator('[role=dialog]').last().innerText()
  await p.screenshot({ path: OUT + '/90-restore.png' })
  return msg.split('\n').filter(Boolean).slice(-3).join(' | ')
}
console.log('wrong pass:', await restore(path.join(os.tmpdir(), 'meztli-locked.json'), 'nope'))
await p.keyboard.press('Escape')
console.log('right pass:', await restore(path.join(os.tmpdir(), 'meztli-locked.json'), 'correct horse'), '→ logs', await count())
await p.keyboard.press('Escape'); await p.evaluate(async () => { const { db } = await import('/src/db/schema.ts'); await db.dailyLogs.clear() })
console.log('plain:', await restore(path.join(os.tmpdir(), 'meztli-plain.json')), '→ logs', await count())
console.log('errs', errs)
await b.close()
