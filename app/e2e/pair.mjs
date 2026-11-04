import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { SHOTS, APP, RELAY } from './env.mjs'
const OUT = SHOTS
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const mk = async (w, h, locale) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale })
  const p = await ctx.newPage()
  p.errs = []
  p.on('pageerror', (e) => p.errs.push(e.message))
  await p.goto(APP, { waitUntil: 'networkidle' })
  return p
}
const owner = await mk(412, 915, 'en-US')
const partner = await mk(440, 956, 'en-US')
const shot = async (p, n) => { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${n}.png` }) }
// Owner onboarding (fast path)
await owner.getByRole('button', { name: /^Me/ }).click()
for (const c of await owner.getByRole('checkbox').all()) await c.check(); await owner.getByRole('button', { name: 'Continue' }).click()
await owner.getByRole('button', { name: 'Continue' }).click()
await owner.locator('input[type=date]').fill(new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10))
await owner.getByRole('button', { name: 'Continue' }).click()
await owner.getByRole('button', { name: 'Skip' }).click()
await owner.getByRole('button', { name: 'Continue' }).click()
await owner.getByRole('button', { name: 'Not now' }).click()
await owner.evaluate(async () => {
  const { db } = await import('/src/db/schema.ts'); const { addDays } = await import('/src/engine/cycle.ts')
  const last = addDays(new Date().toISOString().slice(0, 10), -13)
  let s = last
  for (const l of [29, 30, 28, 29]) { s = addDays(s, -l); for (let i = 0; i < 4; i++) await db.dailyLogs.put({ date: addDays(s, i), flow: 'medium' }) }
  for (let i = 0; i < 4; i++) await db.dailyLogs.put({ date: addDays(last, i), flow: 'medium' })
  await db.dailyLogs.put({ date: new Date().toISOString().slice(0, 10), symptoms: ['Cramps', 'Headache'], notes: 'secret note', intimacyEvents: ['protected'] })
})
// Partner: choose partner role
await partner.getByRole('button', { name: /partner/ }).click()
for (const c of await partner.getByRole('checkbox').all()) await c.check()
await partner.getByRole('button', { name: 'Continue' }).click()
await shot(partner, '30-partner-join')
// Owner: invite
await owner.getByRole('button', { name: /You, tab 5/ }).click()
await owner.getByRole('button', { name: /Partner sharing/ }).click()
await owner.getByRole('button', { name: 'Invite your partner' }).click()
await owner.getByLabel('Your name on their phone').fill('Jas')
await owner.getByRole('button', { name: /Chosen symptoms/ }).click()
await owner.getByRole('button', { name: 'Cramps' }).click()
await owner.getByRole('button', { name: 'Close' }).last().click()
await owner.getByLabel('Relay').fill(RELAY)
await owner.getByRole('button', { name: 'Show pairing code' }).click()
await shot(owner, '31-owner-code')
const code = (await owner.locator('.mz-code').innerText()).replace(/[^A-Z0-9]/g, '')
console.log('code', code)
// Partner joins with code
await partner.getByLabel('Your name on her phone').fill('Kelvin')
await partner.getByLabel(/6-character code/).fill(code)
await partner.getByRole('button', { name: /Change relay/ }).click().catch(() => {})
await partner.getByLabel('Relay').fill(RELAY)
await partner.getByRole('button', { name: 'Join' }).click()
await shot(partner, '32-partner-words')
const pWords = await partner.locator('.mz-title-lg').nth(1).innerText()
await owner.waitForSelector('text=They match', { timeout: 15000 })
await shot(owner, '33-owner-confirm')
const oWords = await owner.locator('.mz-card .mz-title-lg').innerText()
console.log('partner words:', pWords, '| owner words:', oWords, '| match:', pWords === oWords)
await owner.getByRole('button', { name: 'They match' }).click()
await owner.getByRole('button', { name: 'Done' }).click()
await owner.waitForTimeout(4000) // auto upload debounce
await partner.waitForSelector('text=Read only', { timeout: 20000 })
await shot(partner, '34-partner-today')
const partnerText = await partner.locator('main').innerText()
console.log('partner sees secret?', partnerText.includes('secret'), '| Headache leaked?', partnerText.includes('Headache'), '| Cramps shown?', partnerText.includes('Cramps'))
// Owner pauses
await owner.getByRole('switch', { name: /Pause all sharing/ }).click()
await owner.waitForTimeout(1500)
await partner.reload({ waitUntil: 'networkidle' }); await partner.waitForTimeout(2500)
await shot(partner, '35-partner-paused')
console.log('paused shown?', (await partner.locator('main').innerText()).includes('Sharing is paused'))
// Owner revokes
await owner.getByRole('switch', { name: /Pause all sharing/ }).click()
await owner.getByRole('button', { name: 'Stop sharing' }).first().click()
await owner.getByRole('button', { name: 'Stop sharing' }).last().click()
await owner.waitForTimeout(1000)
await partner.reload({ waitUntil: 'networkidle' }); await partner.waitForTimeout(2500)
await shot(partner, '36-partner-revoked')
console.log('revoked shown?', (await partner.locator('main').innerText()).includes('Sharing ended'))
await owner.getByRole('button', { name: 'Back' }).first().click().catch(() => {})
console.log('owner errs', owner.errs, 'partner errs', partner.errs)
await b.close()
