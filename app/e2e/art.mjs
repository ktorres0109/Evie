import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { SHOTS, APP, RELAY } from './env.mjs'
import { createRequire } from 'node:module'
import fs from 'node:fs'
const OUT = SHOTS
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale: 'es-MX' })).newPage()
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(APP, { waitUntil: 'networkidle' })
await p.evaluate(async () => { const { setSetting } = await import('/src/db/schema.ts'); const { updatePrefs } = await import('/src/state/prefs.ts'); await setSetting('onboarded', '1'); await setSetting('legal.accepted', JSON.stringify({ version: (await import('/src/content/legal.ts')).LEGAL_VERSION })); await updatePrefs({ role: 'owner' }) })
await p.reload({ waitUntil: 'networkidle' })
await p.locator('nav button').nth(4).click()
await p.locator('.mz-list-row').filter({ hasText: /Artículos/ }).first().click(); await p.waitForTimeout(500)
await p.screenshot({ path: `${OUT}/99-articles.png` })
const scan = async (n) => { await p.addScriptTag({ content: AXE }); console.log(n, await p.evaluate(async () => (await window.axe.run(document)).violations.map((x) => x.id))) }
await scan('list')
await p.locator('input[type=search]').fill('ovul'); await p.waitForTimeout(300)
console.log('results:', await p.locator('[role=dialog] .mz-list-row').count())
await p.locator('[role=dialog] .mz-list-row').first().click(); await p.waitForTimeout(500)
await scan('reader')
await p.screenshot({ path: `${OUT}/99-article.png` })
await p.locator('.mz-appbar--back button').last().click(); await p.waitForTimeout(400)
console.log('back on list:', await p.locator('input[type=search]').count() === 1, 'errs', errs)
await b.close()
