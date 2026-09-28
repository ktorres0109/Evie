/**
 * Release blocker from the design spec (§5.6, §08): fertility copy must never
 * call a day safe, protected, clear, free, a "green light", infertile, or say
 * someone can't get pregnant. Checked by machine, not reviewer judgement.
 *
 * Two layers:
 *  1. STRICT: every catalogue string whose key starts with a fertility or
 *     partner prefix is checked against the full word list.
 *  2. CLAIMS: every catalogue string and every non-test source file is checked
 *     for phrases that only ever read as a safety claim. Reviewed negations
 *     ("not ... a safe day") go in ALLOWED with a reason.
 */
import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'

const STRICT_KEY_PREFIXES = ['fertility.', 'partner.']

const STRICT_WORDS: RegExp[] = [
  /\bsafe(ly|ty)?\b/i,
  /\bprotected\b/i,
  /\bgreen[ -]light\b/i,
  /\bclear\b/i,
  /\bfree\b/i,
  /\binfertil/i,
  /\bcan(?:'|’)?t get pregnant\b/i,
  /\bcannot get pregnant\b/i,
  // Spanish
  /\bsegur[oa]s?\b/i,
  /\bprotegid[oa]s?\b/i,
  /\bluz verde\b/i,
  /\blibres?\b/i,
  /\binf[eé]rtil/i,
  /\bno (?:puedes|puede|podr[aá]s) (?:quedar embarazada|embarazarte|embarazarse)\b/i,
]

const CLAIM_PHRASES: RegExp[] = [
  /\bgreen[ -]light\b/i,
  /\bcan(?:'|’)?t get pregnant\b/i,
  /\bcannot get pregnant\b/i,
  /\b(?:you are|you(?:'|’)re) (?:protected|safe|infertile)\b/i,
  /\bsafe (?:day|days|window|time|period)\b/i,
  /\bluz verde\b/i,
  /\bd[ií]as? segur[oa]s?\b/i,
  /\bno (?:puedes|puede|podr[aá]s) (?:quedar embarazada|embarazarte|embarazarse)\b/i,
]

/** Reviewed exceptions: file (or catalogue key) + exact substring + why. */
const ALLOWED: { where: string; text: string; reason: string }[] = [
  {
    where: 'engine/predictionContext.ts',
    text: 'not confirmation of ovulation or a safe day',
    reason: 'Negation: states the estimate is NOT a safe day.',
  },
]

function isAllowed(where: string, text: string): boolean {
  return ALLOWED.some((a) => where.endsWith(a.where) && text.includes(a.text))
}

const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

const catalogues = { en, es } as const

describe('fertility vocabulary (release blocker)', () => {
  it('strict prefixes never use a forbidden word', () => {
    const hits: string[] = []
    for (const [lang, cat] of Object.entries(catalogues)) {
      for (const [key, value] of Object.entries(cat)) {
        if (!STRICT_KEY_PREFIXES.some((p) => key.startsWith(p))) continue
        for (const re of STRICT_WORDS) {
          if (re.test(value) && !isAllowed(key, value)) hits.push(`${lang}:${key} ~ ${re} → "${value}"`)
        }
      }
    }
    expect(hits).toEqual([])
  })

  it('no catalogue string makes a safety claim', () => {
    const hits: string[] = []
    for (const [lang, cat] of Object.entries(catalogues)) {
      for (const [key, value] of Object.entries(cat)) {
        for (const re of CLAIM_PHRASES) {
          if (re.test(value) && !isAllowed(key, value)) hits.push(`${lang}:${key} ~ ${re}`)
        }
      }
    }
    expect(hits).toEqual([])
  })

  it('no source file makes a safety claim', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50)
    const hits: string[] = []
    for (const [file, text] of Object.entries(sources)) {
      for (const line of text.split('\n')) {
        for (const re of CLAIM_PHRASES) {
          if (re.test(line) && !isAllowed(file, line)) hits.push(`${file}: ${line.trim().slice(0, 120)}`)
        }
      }
    }
    expect(hits).toEqual([])
  })

  it('the checker itself catches the words it is meant to', () => {
    for (const bad of [
      'Today is a safe day',
      'Green light for today',
      "You can't get pregnant now",
      'Hoy tienes luz verde',
      'Días seguros',
    ]) {
      expect(CLAIM_PHRASES.some((re) => re.test(bad)), bad).toBe(true)
    }
    expect(STRICT_WORDS.some((re) => re.test('Low risk, fertility free'))).toBe(true)
  })
})
