import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'
import { format, resolveLocale } from './index'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('string catalogues', () => {
  it('Spanish has exactly the English keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })

  it('every translation keeps the same placeholders', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]))
    }
  })

  it('no string is empty', () => {
    for (const s of [...Object.values(en), ...Object.values(es)]) expect(s.trim()).not.toBe('')
  })
})

describe('format', () => {
  it('fills the product name and caller values', () => {
    expect(format('{app}: {n} days', { n: 3 })).toBe('Meztli: 3 days')
  })

  it('leaves unknown placeholders visible instead of blank', () => {
    expect(format('{missing}')).toBe('{missing}')
  })
})

describe('resolveLocale', () => {
  it.each([
    [['es-MX'], 'es'],
    [['es'], 'es'],
    [['en-US', 'es-MX'], 'en'],
    [['fr-FR'], 'en'],
    [[], 'en'],
  ])('%j → %s', (langs, expected) => {
    expect(resolveLocale(langs)).toBe(expected)
  })
})
