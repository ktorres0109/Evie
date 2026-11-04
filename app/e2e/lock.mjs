import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { SHOTS, APP, RELAY } from './env.mjs'
import fs from 'node:fs'
const OUT = SHOTS
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale: process.argv[2] || 'en-US' })).newPage()
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(APP, { waitUntil: 'networkidle' })
await p.evaluate(async () => {
  const { setSetting } = await import('/src/db/schema.ts'); const { updatePrefs } = await import('/src/state/prefs.ts')
  const { hashPin, newSalt } = await import('/src/crypto/vault.ts')
  const salt = newSalt(); await setSetting('pinSalt', salt); await setSetting('pinHash', await hashPin('2580', salt))
  await setSetting('onboarded', '1'); await setSetting('legal.accepted', JSON.stringify({ version: (await import('/src/content/legal.ts')).LEGAL_VERSION })); await updatePrefs({ role: 'owner' })
})
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500)
const status = () => p.locator('.mz-lock__status').innerText()
await p.screenshot({ path: `${OUT}/95-lock.png` })
for (let i = 0; i < 5; i++) { await p.keyboard.type('1111'); await p.waitForTimeout(400) }
console.log('after 5 wrong:', await status(), '| key disabled:', await p.locator('.mz-lock__key').first().isDisabled())
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800)
console.log('after restart:', await status())
await p.evaluate(async () => { const { setSetting } = await import('/src/db/schema.ts'); await setSetting('lock.until', '0') })
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800)
await p.getByRole('button', { name: /^2$/ }).click(); await p.getByRole('button', { name: /^5$/ }).click(); await p.getByRole('button', { name: /^8$/ }).click(); await p.getByRole('button', { name: /^0$/ }).click()
await p.waitForTimeout(600)
console.log('unlocked:', (await p.locator('.mz-lock').count()) === 0, '| fails reset:', await p.evaluate(async () => (await import('/src/db/schema.ts')).getSetting('lock.fails')))
console.log('errs', errs)
await b.close()
