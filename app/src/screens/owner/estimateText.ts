/**
 * Shared wording for estimates, so Today, Calendar, "Why this estimate" and the
 * partner snapshot never phrase the same number differently.
 */
import type { CycleState, ExclusionReason, Phase, WidenReason, WithholdReason } from '../../engine/estimate'
import { daysBetween } from '../../engine/cycle'
import type { ContraceptionMethod, LifeEventKind } from '../../db/schema'
import type { MessageKey, Translator } from '../../i18n'
import { dateRange, dayMonth } from '../../i18n/dates'

export function rangeText(state: CycleState, t: Translator, short = false): string | null {
  if (!state.window) return null
  if (state.displayInWeeks) return weeksText(state, t)
  return dateRange(state.window.start, state.window.end, t.locale, short)
}

/** "in about 3–4 weeks" for wide or rough windows. */
export function weeksText(state: CycleState, t: Translator): string | null {
  if (!state.window) return null
  const from = Math.max(0, daysBetween(state.today, state.window.start))
  const to = Math.max(from, daysBetween(state.today, state.window.end))
  const a = Math.max(1, Math.round(from / 7))
  const b = Math.max(a, Math.round(to / 7))
  if (to <= 0) return t('estimate.couldStartAnyDay')
  return a === b ? t.n('estimate.aboutWeeks', a) : t('estimate.aboutWeeksRange', { a, b })
}

/** Countdown pill: "in 12 days", "any day now", "3 days past the window". */
export function countdownText(state: CycleState, t: Translator): string | null {
  if (!state.window) return null
  if (state.phase === 'late') return t.n('estimate.daysPast', state.daysLate)
  if (state.daysUntilWindow === 0) return t('estimate.couldStartAnyDay')
  if (state.daysUntilWindow === null) return null
  if (state.displayInWeeks) return weeksText(state, t)
  return t.n('estimate.inDays', state.daysUntilWindow)
}

export function phaseText(phase: Phase, t: Translator, state: CycleState): string | null {
  switch (phase) {
    case 'early':
      return t('phase.early')
    case 'mid':
      return t('phase.mid')
    case 'later':
      return t('phase.later')
    case 'window':
      return t('phase.window')
    case 'late':
      return t.n('estimate.daysPast', state.daysLate)
    case 'period':
      return t('phase.period')
    default:
      return null
  }
}

export function confidenceLine(state: CycleState, t: Translator): string {
  return t.n('confidence.line', state.used.length, { word: t(`confidence.${state.confidence}` as MessageKey) })
}

export function methodName(method: ContraceptionMethod, t: Translator): string {
  return t(`method.${method}` as MessageKey)
}

export function lifeKindName(kind: LifeEventKind, t: Translator): string {
  return t(`life.kind.${kind}` as MessageKey)
}

export function exclusionText(reason: ExclusionReason, t: Translator): string {
  switch (reason.code) {
    case 'implausible-length':
      return t('why.excluded.implausible')
    case 'outlier':
      return t('why.excluded.outlier')
    case 'life-event':
      return t('why.excluded.lifeEvent', { what: lifeKindName(reason.kind, t).toLowerCase() })
    case 'hormonal-method':
      return t('why.excluded.method', { method: methodName(reason.method, t) })
    case 'pregnancy':
      return t('why.excluded.pregnancy')
  }
}

export function widenText(reason: WidenReason, t: Translator): string {
  return t(`why.widen.${reason}` as MessageKey)
}

export function withheldTitle(reason: WithholdReason, t: Translator): string {
  if (reason.code === 'hormonal-method') return t('withheld.method.title', { method: methodName(reason.method, t) })
  return t(`withheld.${reason.code}.title` as MessageKey)
}

export function withheldBody(reason: WithholdReason, t: Translator): string {
  const since = dayMonth(reason.since, t.locale)
  if (reason.code === 'hormonal-method') return t('withheld.method.body', { method: methodName(reason.method, t), since })
  return t(`withheld.${reason.code}.body` as MessageKey, { since })
}
