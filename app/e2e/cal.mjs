import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { SHOTS, APP, RELAY } from './env.mjs'
import { createRequire } from 'node:module'
import fs from 'node:fs'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, locale: 'en-US' })).newPage()
await p.goto(APP, { waitUntil: 'networkidle' })
await p.evaluate(async () => { const { setSetting } = await import('/src/db/schema.ts'); const { updatePrefs } = await import('/src/state/prefs.ts'); await setSetting('onboarded', '1'); await setSetting('legal.accepted', JSON.stringify({ version: (await import('/src/content/legal.ts')).LEGAL_VERSION })); await updatePrefs({ role: 'owner' }) })
await p.reload({ waitUntil: 'networkidle' })
await p.locator('nav button').nth(1).click(); await p.waitForTimeout(400)
await p.addScriptTag({ content: fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8') })
const v = await p.evaluate(async () => (await window.axe.run(document)).violations.map((x) => x.id + ':' + x.impact))
console.log('axe:', v)
await p.locator('[aria-current=date]').focus()
const lab = () => p.evaluate(() => document.activeElement.getAttribute('aria-label'))
console.log('start', await lab())
await p.keyboard.press('ArrowRight'); console.log('→', await lab())
await p.keyboard.press('ArrowUp'); console.log('↑', await lab())
await p.keyboard.press('Home'); console.log('Home', await lab())
await p.keyboard.press('Enter'); await p.waitForTimeout(400)
console.log('sheet opened:', await p.locator('.mz-sheet').count())
await b.close()
