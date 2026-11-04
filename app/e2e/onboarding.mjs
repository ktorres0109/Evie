import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { SHOTS, APP, RELAY } from './env.mjs'
import { createRequire } from 'node:module'
import fs from 'node:fs'
const OUT = SHOTS
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const axe = async (p, n) => { await p.addScriptTag({ content: AXE }); const v = await p.evaluate(async () => (await window.axe.run(document)).violations.map((x) => x.id)); if (v.length) console.log('AXE', n, v) }
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` })
// ---- Owner, Spanish
{
  const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale: 'es-MX' })).newPage()
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await p.goto(APP, { waitUntil: 'networkidle' })
  const primary = () => p.locator('.mz-btn--primary').last()
  await p.locator('button').filter({ hasText: /^Mío/ }).first().click()
  await p.getByRole('checkbox').first().check()
  console.log('continue disabled with only age:', await primary().isDisabled())
  await p.getByRole('button', { name: 'Leer los términos' }).click(); await p.waitForTimeout(400)
  console.log('terms heading:', await p.locator('[role=dialog] h1').first().innerText())
  await axe(p, 'terms'); await shot(p, 'L1-terms')
  await p.locator('[role=dialog] .mz-appbar--back button').first().click(); await p.waitForTimeout(300)
  await p.getByRole('checkbox').nth(1).check()
  await shot(p, 'L0-privacy-step'); await axe(p, 'privacy-step')
  console.log('continue enabled with both:', !(await primary().isDisabled()))
  await primary().click()
  await p.locator('input.mz-input').first().fill('Jasmine'); await shot(p, 'L2-name')
  await primary().click()
  await p.locator('input[type=date]').fill(new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10)); await primary().click()
  await p.locator('.mz-btn--ghost').last().click(); await primary().click(); await p.locator('.mz-btn--ghost').last().click()
  await p.waitForTimeout(700)
  const today = await p.locator('main').innerText()
  console.log('greeting:', today.split('\n').find((l) => /Jasmine/.test(l)), '| guide card:', today.includes('Guía de dos minutos'))
  await shot(p, 'L3-today'); await axe(p, 'today')
  const saved = await p.evaluate(async () => { const { getSetting } = await import('/src/db/schema.ts'); return [await getSetting('profile.name'), await getSetting('legal.accepted')] })
  console.log('saved:', saved)
  await p.locator('button').filter({ hasText: 'Guía de dos minutos' }).click(); await p.waitForTimeout(400)
  await shot(p, 'L4-guide'); await axe(p, 'guide')
  const shows = await p.getByRole('button', { name: 'Muéstrame' }).count()
  console.log('show-me buttons:', shows)
  const closeAll = async () => { for (let k = 0; k < 6 && (await p.locator('[role=dialog]').count()); k++) { await p.keyboard.press('Escape'); await p.waitForTimeout(250) } }
  for (let i = 0; i < shows; i++) {
    if (i > 0) {
      await closeAll()
      await p.locator('nav button').nth(4).click(); await p.waitForTimeout(300)
      await p.locator('.mz-list-row').filter({ hasText: /Cómo funciona/ }).click(); await p.waitForTimeout(400)
    }
    await p.getByRole('button', { name: 'Muéstrame' }).nth(i).click(); await p.waitForTimeout(450)
    const where = await p.evaluate(() => [...document.querySelectorAll('[role=dialog]')].map((d) => d.getAttribute('aria-label') || d.querySelector('h1,h2')?.textContent).join(' > ') || 'tab: ' + document.querySelector('.mz-tab[aria-current=page]')?.getAttribute('aria-label'))
    console.log('  show', i, '→', where)
  }
  await closeAll()
  await p.locator('nav button').nth(0).click(); await p.waitForTimeout(300)
  console.log('guide card gone after visit:', !(await p.locator('main').innerText()).includes('Guía de dos minutos'))
  await p.locator('nav button').nth(4).click(); await p.waitForTimeout(300)
  await p.locator('.mz-list-row').filter({ hasText: /Acerca de/ }).click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: 'Política de privacidad' }).click(); await p.waitForTimeout(300)
  console.log('privacy opened from About:', await p.locator('[role=dialog] h1').last().innerText())
  // Legal gate: pretend an older acceptance
  await p.evaluate(async () => { const { setSetting } = await import('/src/db/schema.ts'); await setSetting('legal.accepted', JSON.stringify({ version: '2000-01-01' })) })
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  console.log('gate shown:', await p.locator('h1').first().innerText())
  await shot(p, 'L5-gate')
  for (const c of await p.getByRole('checkbox').all()) await c.check(); await p.locator('.mz-btn--primary').last().click(); await p.waitForTimeout(600)
  console.log('after gate, Today:', (await p.locator('main').innerText()).includes('Jasmine'))
  console.log('owner errs', errs)
}
// ---- Partner path, English
{
  const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage()
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(APP, { waitUntil: 'networkidle' })
  await p.locator('button').filter({ hasText: /partner/ }).first().click(); await p.waitForTimeout(300)
  console.log('partner step:', await p.locator('h1').first().innerText()); await shot(p, 'L6-partner'); await axe(p, 'partner-step')
  await p.getByRole('checkbox').nth(0).check(); await p.getByRole('checkbox').nth(1).check()
  await p.locator('.mz-btn--primary').last().click(); await p.waitForTimeout(500)
  console.log('partner join shown:', (await p.locator('h1').first().innerText()))
  console.log('partner errs', errs)
}
await b.close()
