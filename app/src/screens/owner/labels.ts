/**
 * Display names for stored taxonomy values. Logs store stable English ids
 * (e.g. "Headache") so history survives a language switch; the label is
 * looked up at render time and falls back to the stored text.
 */
import { catalogue, type MessageKey, type Translator } from '../../i18n'

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function lookup(prefix: string, value: string, t: Translator): string {
  const key = `${prefix}.${slug(value)}` as MessageKey
  return catalogue(t.locale)[key] ?? value
}

export const symptomLabel = (value: string, t: Translator) => lookup('symptom', value, t)

/** Any logged signal (symptom, mood word, or event), labelled and capitalised. */
export function signalLabel(value: string, t: Translator): string {
  const cat = catalogue(t.locale)
  for (const prefix of ['symptom', 'mood', 'discharge']) {
    const hit = cat[`${prefix}.${slug(value)}` as MessageKey]
    if (hit) return hit
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function isSymptom(value: string, t: Translator): boolean {
  return Boolean(catalogue(t.locale)[`symptom.${slug(value)}` as MessageKey])
}
export const moodLabel = (value: string, t: Translator) => lookup('mood', value, t)
export const dischargeLabel = (value: string, t: Translator) => lookup('discharge', value, t)
export const intimacyLabel = (value: string, t: Translator) => lookup('intimacy', value, t)

/** Shown first in the log; the rest sit behind "+ N more", reordered by use. */
export const COMMON_SYMPTOMS = ['Headache', 'Cramps', 'Tender breasts', 'Bloating', 'Nausea', 'Back pain', 'Acne']

export const PAIN_SYMPTOMS = [
  'Cramps',
  'Headache',
  'Migraine',
  'Back pain',
  'Abdominal pain',
  'Tender breasts',
  'Ovulation pain',
  'Joint pain',
  'Muscle aches',
]

export const DISCHARGE_IDS = ['none', 'sticky', 'creamy', 'egg-white', 'watery', 'unusual', 'clumpy-white', 'gray'] as const

export const INTIMACY_IDS = [
  'no-sex',
  'protected',
  'unprotected',
  'oral',
  'masturbation',
  'sensual-touch',
  'sex-toys',
  'orgasm',
  'high-drive',
  'low-drive',
] as const
