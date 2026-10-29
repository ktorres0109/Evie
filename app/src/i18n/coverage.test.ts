/**
 * Keys built at runtime (`t(\`life.kind.${kind}\`)`) aren't checked by the type
 * system, so every family is enumerated here against the real value lists.
 */
import { describe, expect, it } from 'vitest'
import { MOOD_WORDS, type ContraceptionMethod, type LifeEventKind, type PregnancyOutcome } from '../db/schema'
import { SYMPTOMS } from '../db/taxonomy'
import type { FertilityState, FertilityUnknownReason, WidenReason, WithholdReason } from '../engine/estimate'
import { LIFE_EFFECT } from '../screens/owner/LifeScreen'
import { DISCHARGE_IDS, INTIMACY_IDS, slug } from '../screens/owner/labels'
import { CARE_RESOURCES } from '../content/careResources'
import { en } from './en'

const has = (key: string) => Object.prototype.hasOwnProperty.call(en, key)

const LIFE_KINDS = Object.keys(LIFE_EFFECT) as LifeEventKind[]
const METHODS: ContraceptionMethod[] = [
  'none', 'combined-pill-patch-ring', 'progestin-only-pill', 'injection', 'implant', 'hormonal-iud', 'copper-iud',
  'barrier', 'withdrawal', 'fertility-awareness', 'partner-vasectomy', 'sterilization', 'other', 'unknown', 'prefer-not-to-say',
]
const CHOICES = ['pill-combined', 'pill-progestin', 'patch', 'ring', 'injection', 'implant', 'iud-hormonal', 'iud-copper', 'barrier', 'withdrawal', 'fertility-awareness', 'partner-vasectomy', 'other']
const WIDEN: WidenReason[] = ['settling-after-hormonal', 'settling-after-pregnancy', 'emergency-contraception', 'pcos', 'endometriosis', 'thyroid', 'perimenopause', 'weight-change', 'intense-training', 'irregular-reported']
const WITHHOLD: WithholdReason['code'][] = ['pregnancy', 'postpartum', 'breastfeeding', 'testosterone', 'hysterectomy', 'menopause']
const FERT: FertilityState[] = ['potential', 'unknown', 'lower', 'suppressed']
const UNKNOWN: FertilityUnknownReason[] = ['few-cycles', 'wide-spread', 'settling', 'emergency-contraception', 'no-estimate', 'condition']
const OUTCOMES: PregnancyOutcome[] = ['birth', 'miscarriage', 'abortion', 'ectopic', 'other', 'prefer-not-to-say']
const PHASES = ['period', 'early', 'mid', 'later', 'window', 'late', 'unknown']

const families: [string, string[]][] = [
  ['life.kind', LIFE_KINDS.map((k) => `life.kind.${k}`)],
  ['life.explain', LIFE_KINDS.map((k) => `life.explain.${k}`)],
  ['life.effect', ['withhold', 'widen', 'exclude', 'note'].flatMap((e) => [`life.effect.${e}`, `life.effect.${e}.short`])],
  ['method', METHODS.map((m) => `method.${m}`)],
  ['choice', CHOICES.flatMap((c) => [`choice.${c}`, `choice.${c}.sub`])],
  ['why.widen', WIDEN.map((w) => `why.widen.${w}`)],
  ['withheld', [...WITHHOLD.flatMap((w) => [`withheld.${w}.title`, `withheld.${w}.body`]), 'withheld.method.title', 'withheld.method.body']],
  ['fertility.state', FERT.flatMap((s) => [`fertility.state.${s}`, `fertility.state.${s}.sub`, `fertility.today.${s}`])],
  ['fertility.unknown', UNKNOWN.map((u) => `fertility.unknown.${u}`)],
  ['preg.outcome', OUTCOMES.map((o) => `preg.outcome.${o}`)],
  ['preg.method', ['lmp', 'clinician-edd', 'conception', 'ivf-day-3', 'ivf-day-5'].map((m) => `preg.method.${m}`)],
  ['pview.phase', PHASES.flatMap((p) => [`pview.phase.${p}.a`, `pview.phase.${p}.b`])],
  ['confidence', [1, 2, 3, 4, 5].flatMap((n) => [`confidence.${n}`, `number.${n}`])],
  ['companion', [0, 1, 2, 3, 4, 5].flatMap((n) => [`companion.stageLine.${n}`, `companion.stageName.${n}`])],
  ['phaseName', ['menstrual', 'follicular', 'ovulatory', 'luteal'].map((p) => `phaseName.${p}`)],
  ['symptom', (SYMPTOMS as readonly string[]).map((s) => `symptom.${slug(s)}`)],
  ['mood', MOOD_WORDS.map((m) => `mood.${m}`)],
  ['discharge', DISCHARGE_IDS.map((d) => `discharge.${d}`)],
  ['intimacy', INTIMACY_IDS.map((d) => `intimacy.${d}`)],
  ['resource', CARE_RESOURCES.map((r) => `resource.${r.about}`)],
  ['tone', ['warm', 'neutral', 'minimal', 'off'].flatMap((x) => [`tone.${x}`, `tone.${x}.sub`])],
  ['appearance', ['night', 'day', 'system'].flatMap((x) => [`appearance.${x}`, `appearance.${x}.sub`])],
  ['ledger', ['partner-update', 'partner-revoke', 'export-file', 'backup'].flatMap((k) => [`privacy.ledger.${k}.one`, `privacy.ledger.${k}.other`])],
  ['withdrawal', ['pill', 'patch', 'ring'].flatMap((m) => [`today.card.withdrawalNote.${m}`, `why.withdrawal.${m}`])],
  ['safety', ['routine', 'same-day', 'emergency'].flatMap((u) => [`safety.${u}.title`, `safety.${u}.action`])],
  ['errors', ['no-relay', 'offline', 'generic'].map((e) => `partner.err.${e}`).concat(['not-found', 'used', 'offline', 'no-relay', 'generic'].map((e) => `pjoin.err.${e}`))],
  ['ob', ['none', 'pill', 'patch-ring', 'iud-implant-shot', 'condoms', 'other'].map((m) => `ob.method.${m}`).concat(['local', 'noAccount', 'yourChoice'].map((k) => `ob.privacy.${k}`))],
  ['misc', ['aftercare.bleeding', 'aftercare.fever', 'aftercare.pain', 'aftercare.discharge', 'aftercare.faint', 'comfort.heat', 'comfort.move', 'comfort.pain', 'comfort.water', 'comfort.rest', 'notify.method', 'notify.window', 'notify.checkIn.neutral', 'notify.checkIn.warm', 'opk.positive', 'opk.negative', 'test.negative', 'test.faint', 'test.positive', 'severity.mild', 'severity.moderate', 'severity.severe', 'impact.none', 'impact.noticeable', 'impact.limited-routine', 'flow.heavy', 'flow.light', 'flow.medium', 'flow.veryHeavy']],
]

describe('dynamic catalogue keys', () => {
  it.each(families)('%s', (_name, keys) => {
    expect(keys.filter((k) => !has(k))).toEqual([])
  })
})
