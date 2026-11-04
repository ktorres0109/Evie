/**
 * docs/legal/*.md must match the in-app text exactly.
 * Regenerate after editing legal.ts: UPDATE_LEGAL=1 pnpm test -- legal
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEGAL_VERSION, legalText, type LegalDoc } from './legal'

const DIR = path.resolve(__dirname, '../../../docs/legal')
const FILE: Record<LegalDoc, string> = { terms: 'TERMS', privacy: 'PRIVACY' }

function markdown(doc: LegalDoc, locale: 'en' | 'es'): string {
  const t = legalText(doc, locale)
  const out = [`# ${t.title}`, '', `_${t.updated} · version ${LEGAL_VERSION}_`, '', ...t.summary.map((p) => `- ${p}`), '']
  for (const s of t.sections) out.push(`## ${s.heading}`, '', ...s.body.flatMap((p) => [p, '']))
  out.push('---', '', locale === 'en' ? '_This text is generated from `app/src/content/legal.ts`, the version shown in the app._' : '_Este texto se genera desde `app/src/content/legal.ts`, la versión que muestra la app._', '')
  return out.join('\n')
}

describe('legal documents', () => {
  for (const doc of ['terms', 'privacy'] as const)
    for (const locale of ['en', 'es'] as const) {
      it(`docs/legal/${FILE[doc]}.${locale}.md is in sync`, () => {
        const file = path.join(DIR, `${FILE[doc]}.${locale}.md`)
        const want = markdown(doc, locale)
        if (process.env.UPDATE_LEGAL) {
          fs.mkdirSync(DIR, { recursive: true })
          fs.writeFileSync(file, want)
        }
        expect(fs.readFileSync(file, 'utf8')).toBe(want)
      })
    }

  it('English and Spanish have the same structure', () => {
    for (const doc of ['terms', 'privacy'] as const) {
      const en = legalText(doc, 'en')
      const es = legalText(doc, 'es')
      expect(es.summary.length).toBe(en.summary.length)
      expect(es.sections.map((s) => s.body.length)).toEqual(en.sections.map((s) => s.body.length))
    }
  })
})
