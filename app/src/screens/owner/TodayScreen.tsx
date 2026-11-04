/**
 * Owner — Today (spec §5.2). Six blocks in a fixed order, no feed:
 * hero, prediction card, quick-log row, optional fertility card, one insight
 * (or a calm empty state), companion. State variants: bleeding, late,
 * withheld (method / pregnancy / postpartum …), no history, stale.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { analyzePatterns, type PatternInsight } from '../../engine/patterns'
import { phaseAnalysisInput } from '../../engine/estimate'
import { resolvePregnancyDating, pregnancyTimeline } from '../../engine/pregnancyDating'
import { useT, type MessageKey, type Translator } from '../../i18n'
import { betweenDates, dateRange } from '../../i18n/dates'
import { dailyLogHasEntry, getSetting, removeSetting, setSetting } from '../../db/schema'
import { greetingKey, useOwnerName } from '../../state/profileName'
import { GUIDE_SEEN } from './GuideScreen'
import { activeRegimenOn } from '../../db/regimen'
import { addDays, daysBetween } from '../../engine/cycle'
import { setBleeding } from '../../db/logs'

const ASK_DISMISSED = 'today.askPeriod.dismissed'
import { useNav, type QuickKind } from '../../state/nav'
import type { Prefs } from '../../state/prefs'
import type { CycleData } from '../../state/useCycle'
import { Icon, type IconName } from '../../ui/icons'
import { BrandBar, ConfidenceMeter, FertilityChip, Plant } from '../../ui/kit'
import { confidenceLine, countdownText, phaseText, rangeText, withheldBody, withheldTitle } from './estimateText'
import { isSymptom, signalLabel } from './labels'
import { SK_METHOD_PENDING } from './MethodScreen'

const QUICK: { kind: QuickKind; icon: IconName; label: MessageKey }[] = [
  { kind: 'flow', icon: 'drop', label: 'log.flow' },
  { kind: 'mood', icon: 'smiley-meh', label: 'log.mood' },
  { kind: 'pain', icon: 'lightning', label: 'log.pain' },
  { kind: 'discharge', icon: 'drop-half', label: 'log.discharge' },
]

function quickDone(kind: QuickKind, data: CycleData): boolean {
  const log = data.logsByDate.get(data.today)
  if (!log) return false
  switch (kind) {
    case 'flow':
      return Boolean(log.flow || log.spotting || log.noBleeding)
    case 'mood':
      return Boolean(log.moods?.length)
    case 'pain':
      return Boolean(log.symptoms?.length)
    case 'discharge':
      return Boolean(log.discharge)
  }
}

function pickInsight(data: CycleData, t: Translator): PatternInsight | null {
  if (data.state.used.length < 1) return null
  const { starts, logs } = phaseAnalysisInput(data.state, data.logs)
  if (starts.length < 2) return null
  const insights = analyzePatterns(logs, starts, { maxInsights: 6 })
  const eligible = insights.filter(
    (i) => i.kind !== 'co-occurrence' && i.evidence.loggedDaysCompared >= 8 && i.confidence !== 'early',
  )
  // Symptoms say more than mood words; prefer them when both qualify.
  return eligible.find((i) => isSymptom(i.signal, t)) ?? eligible[0] ?? null
}

function insightSentence(insight: PatternInsight, t: Translator): string {
  const signal = signalLabel(insight.signal, t)
  const e = insight.evidence
  if (e.cycleDayRange) {
    return t('today.insight.days', {
      signal,
      n: e.occurrences,
      total: e.loggedDaysCompared,
      start: e.cycleDayRange.start,
      end: e.cycleDayRange.end,
    })
  }
  return t('today.insight.phase', {
    signal,
    phase: t(`phaseName.${e.phase ?? 'luteal'}` as MessageKey),
    n: e.occurrences,
    total: e.loggedDaysCompared,
  })
}

function packDay(data: CycleData): { day: number; total: number } | null {
  const active = activeRegimenOn(data.regimens, data.today)
  const c = active?.config
  if (!c) return null
  const start = c.kind === 'pill' ? c.currentPackStart : c.kind === 'patch' ? c.currentPatchStart : c.kind === 'ring' ? c.currentRingStart : undefined
  const total = c.kind === 'pill' ? c.activePillsPerPack + c.placeboPillsPerPack : c.kind === 'patch' || c.kind === 'ring' ? c.cycle.wearDays + c.cycle.ringFreeDays : 0
  if (!start || !total) return null
  const elapsed = daysBetween(start, data.today)
  return { day: (((elapsed % total) + total) % total) + 1, total }
}

export function TodayScreen({ data, prefs, locked }: { data: CycleData; prefs: Prefs; locked: boolean }) {
  const t = useT()
  const { push, openQuick, openLog } = useNav()
  const s = data.state
  const insight = useMemo(() => pickInsight(data, t), [data, t.locale])
  const methodPending = useLiveQuery(async () => (await getSetting(SK_METHOD_PENDING)) === '1', [])
  const guideSeen = useLiveQuery(async () => (await getSetting(GUIDE_SEEN)) === '1', [])
  // Ask once a day from two days before the estimated window, or when late,
  // unless she's already bleeding, on a hormonal method/pregnant (withheld), or said not yet today.
  const askDismissed = useLiveQuery(async () => (await getSetting(ASK_DISMISSED)) ?? '', [])
  const todayLog = data.logsByDate.get(data.today)
  // Yesterday was a flow day and today is still empty: offer one tap either way.
  const yesterdayFlow = data.logsByDate.get(addDays(data.today, -1))?.flow
  const askContinue = s.periodDay !== null && Boolean(yesterdayFlow) && !todayLog?.flow && !todayLog?.spotting && !todayLog?.noBleeding
  const askPeriod =
    askDismissed !== undefined &&
    askDismissed !== data.today &&
    s.status === 'ok' &&
    s.periodDay === null &&
    !todayLog?.flow &&
    !todayLog?.spotting &&
    s.window !== null &&
    data.today >= addDays(s.window.start, -2)
  const ownerName = useOwnerName()

  const pregnancy =
    s.withheld?.code === 'pregnancy'
      ? (() => {
          const dating = data.profile.reproductive.pregnancyDating
          const result = dating
            ? resolvePregnancyDating({ method: dating.method, date: dating.inputDate, clinicianConfirmed: dating.authority === 'clinician-assigned' })
            : data.profile.reproductive.pregnancyLmp
              ? resolvePregnancyDating({ method: 'lmp', date: data.profile.reproductive.pregnancyLmp })
              : undefined
          return result ? pregnancyTimeline(result, data.today) : null
        })()
      : null

  // ---------- Hero ----------
  let heroMain: string
  let heroAside: string | null = null
  let heroLine: string | null = null
  let heroBerry = false
  if (pregnancy) {
    heroMain = t('today.hero.pregnancyWeek', { n: pregnancy.week })
    heroAside = t.n('today.hero.pregnancyDay', pregnancy.dayOfWeek)
    heroLine = t('today.hero.pregnancyLine')
  } else if (s.periodDay !== null) {
    heroMain = t('today.hero.periodDay', { n: s.periodDay })
    heroLine = t('today.hero.periodLine')
    heroBerry = true
  } else if (s.status === 'no-history') {
    heroMain = t('today.hero.start')
  } else if (s.status === 'stale') {
    heroMain = t('today.hero.welcomeBack')
    heroLine = t('today.hero.staleLine')
  } else if (s.withheld) {
    // Cycle days mean nothing on a hormonal method, pregnancy or postpartum.
    const pack = s.withdrawalBleed ? packDay(data) : null
    heroMain = pack ? t('today.hero.packDay', { n: pack.day }) : t('today.hero.today')
    heroAside = pack ? t('today.hero.ofPack', { n: pack.total }) : null
  } else if (s.cycleDay !== null) {
    heroMain = t('today.hero.day', { n: s.cycleDay })
    heroAside = s.typicalLength && s.status !== 'withheld' ? t('today.hero.ofAbout', { n: s.typicalLength }) : null
    heroLine =
      s.status === 'ok'
        ? phaseText(s.phase, t, s)
        : s.status === 'insufficient'
          ? t('today.hero.learning')
          : null
  } else {
    heroMain = t('today.hero.today')
  }

  const heroAria = [heroMain, heroAside, heroLine].filter(Boolean).join(', ')

  return (
    <div className="mz-page">
      <BrandBar
        trailing={
          <button type="button" className="mz-icon-btn" onClick={() => push({ name: 'lock' })} aria-label={t(locked ? 'today.lockOn' : 'today.lockOff')}>
            <Icon name="lock-simple" size={22} />
          </button>
        }
      />

      <section className="mz-hero">
        <p className="mz-body mz-muted" style={{ marginBottom: 4 }}>
          {ownerName ? t(`${greetingKey(new Date().getHours())}.name` as MessageKey, { name: ownerName }) : t(greetingKey(new Date().getHours()))}
        </p>
        <h1 className="mz-sr-only">{heroAria}</h1>
        <div className="mz-row" style={{ alignItems: 'flex-end', gap: 14, marginBottom: 6, flexWrap: 'wrap' }} aria-hidden="true">
          <div className={s.status === 'no-history' || s.status === 'stale' ? 'mz-display-md' : 'mz-display'} style={heroBerry ? { color: 'var(--berry-hi)' } : undefined}>
            {heroMain}
          </div>
          {heroAside && <div className="mz-muted" style={{ fontSize: 15, paddingBottom: 8 }}>{heroAside}</div>}
        </div>
        {heroLine && (
          <div aria-hidden="true" style={{ fontSize: 16, color: heroBerry ? 'var(--berry-hi)' : 'var(--primary-hi)' }}>
            {heroLine}
          </div>
        )}
      </section>

      {/* ---------- Prediction card ---------- */}
      <PredictionCard data={data} />

      {/* ---------- Quick log ---------- */}
      <section className="mz-section" aria-label={t('today.logToday')}>
        <h2 className="mz-caption" style={{ margin: '0 0 10px 2px', fontWeight: 400 }}>
          {t('today.logToday')}
        </h2>
        <div className="mz-quick">
          {QUICK.map((q) => {
            const done = quickDone(q.kind, data)
            return (
              <button
                key={q.kind}
                type="button"
                className={`mz-quick__btn${done ? ' is-done' : ''}`}
                onClick={() => openQuick(q.kind, data.today)}
                aria-label={done ? t('today.quickDone', { what: t(q.label) }) : t(q.label)}
              >
                <Icon name={q.icon} size={24} style={q.kind === 'flow' ? { color: 'var(--berry-hi)' } : undefined} />
                <span>{t(q.label)}</span>
              </button>
            )
          })}
          <button type="button" className="mz-quick__btn mz-quick__btn--more" onClick={() => openLog(data.today)}>
            <Icon name="dots-three" size={24} />
            <span>{t('log.more')}</span>
          </button>
        </div>
      </section>

      {/* ---------- During a period, today not logged yet: still going? ---------- */}
      {askContinue && (
        <section className="mz-section">
          <div className="mz-card mz-stack" style={{ gap: 10 }}>
            <div className="mz-title">{t('today.still.title')}</div>
            <div className="mz-row">
              <button type="button" className="mz-btn mz-btn--secondary mz-grow" onClick={() => void setBleeding(data.today, 'none')}>
                {t('today.still.ended')}
              </button>
              <button type="button" className="mz-btn mz-btn--primary mz-grow" onClick={() => void setBleeding(data.today, yesterdayFlow ?? 'medium')}>
                {t('today.still.yes')}
              </button>
            </div>
            <p className="mz-caption">{t('today.still.note')}</p>
          </div>
        </section>
      )}

      {/* ---------- Period due or late: one tap to log it ---------- */}
      {askPeriod && (
        <section className="mz-section">
          <div className="mz-card mz-stack" style={{ gap: 10, boxShadow: 'inset 0 0 0 1.5px var(--berry-hi)' }}>
            <div className="mz-title">{t('today.ask.title')}</div>
            <p className="mz-body-sm mz-muted">{t('today.ask.body')}</p>
            <div className="mz-row">
              <button type="button" className="mz-btn mz-btn--ghost mz-grow" onClick={() => void setSetting(ASK_DISMISSED, data.today)}>
                {t('today.ask.no')}
              </button>
              <button
                type="button"
                className="mz-btn mz-btn--primary mz-grow"
                onClick={async () => {
                  await setBleeding(data.today, 'medium')
                  openQuick('flow', data.today)
                }}
              >
                {t('today.ask.yes')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---------- First days: a short guide ---------- */}
      {guideSeen === false && (
        <section className="mz-section">
          <div className="mz-card mz-row" style={{ gap: 14 }}>
            <Icon name="question" size={26} style={{ color: 'var(--primary-hi)', flex: 'none' }} />
            <button type="button" className="mz-grow mz-link" style={{ textAlign: 'left' }} onClick={() => push({ name: 'guide' })}>
              <span className="mz-title" style={{ display: 'block' }}>{t('guide.card.title')}</span>
              <span className="mz-body-sm mz-muted">{t('guide.card.body')}</span>
            </button>
            <button type="button" className="mz-icon-btn" aria-label={t('common.notNow')} onClick={() => void setSetting(GUIDE_SEEN, '1')}>
              <Icon name="x" size={20} />
            </button>
          </div>
        </section>
      )}

      {/* ---------- Birth control details still missing (from onboarding) ---------- */}
      {methodPending && !activeRegimenOn(data.regimens, data.today)?.config && (
        <section className="mz-section mz-card mz-stack" style={{ gap: 10 }}>
          <div className="mz-title">{t('today.methodSetup.title')}</div>
          <p className="mz-body-sm mz-muted">{t('today.methodSetup.body')}</p>
          <div className="mz-row">
            <button type="button" className="mz-btn mz-btn--ghost mz-grow" onClick={() => void removeSetting(SK_METHOD_PENDING)}>
              {t('common.notNow')}
            </button>
            <button type="button" className="mz-btn mz-btn--primary mz-grow" onClick={() => push({ name: 'method' })}>
              {t('today.methodSetup.go')}
            </button>
          </div>
        </section>
      )}

      {/* ---------- Fertility (only in fertility-awareness mode) ---------- */}
      {prefs.fertilityMode && (
        <section className="mz-section">
          <FertilityChip
            state={s.fertility.state}
            onClick={() => push({ name: 'fertility' })}
            sub={s.fertility.state === 'suppressed' ? t('fertility.suppressedShort') : undefined}
          />
        </section>
      )}

      {/* ---------- One insight, or none ---------- */}
      <section className="mz-section mz-card" style={{ padding: '18px 20px' }}>
        <div className="mz-label" style={{ marginBottom: 8 }}>
          {t('today.insight.title')}
        </div>
        {insight ? (
          <>
            <p className="mz-body" style={{ fontSize: 15, lineHeight: 1.55, marginBottom: 8 }}>
              {insightSentence(insight, t)}
            </p>
            <p className="mz-caption">{t('today.insight.caveat')}</p>
          </>
        ) : (
          <p className="mz-body-sm mz-muted">{t('today.insight.empty')}</p>
        )}
      </section>

      {/* ---------- Companion ---------- */}
      <section className="mz-section">
        <button type="button" className="mz-card mz-card--button mz-row" style={{ padding: '16px 20px', gap: 16 }} onClick={() => push({ name: 'companion' })}>
          <Plant stage={data.companion.stage} resting={data.companion.resting} />
          <span className="mz-grow">
            <span style={{ display: 'block', fontSize: 15, marginBottom: 3 }}>
              {data.companion.resting
                ? t('companion.resting')
                : t.n('companion.thisCycle', data.companion.checkInsThisCycle)}
            </span>
            <span className="mz-body-sm mz-muted" style={{ display: 'block' }}>
              {data.companion.stage > prefs.plantStageSeen && !data.companion.resting ? (
                <span style={{ color: 'var(--care)' }}>{t('companion.grew')} </span>
              ) : null}
              {t(`companion.stageLine.${data.companion.stage}` as MessageKey)}
            </span>
          </span>
          <Icon name="caret-right" size={18} className="mz-faint" />
        </button>
      </section>

      {!dailyLogHasEntry(data.logsByDate.get(data.today) ?? { date: data.today }) && s.status === 'no-history' && (
        <p className="mz-caption mz-gutter" style={{ marginTop: 8 }}>
          {t('today.firstRunHint')}
        </p>
      )}
    </div>
  )
}

function PredictionCard({ data }: { data: CycleData }) {
  const t = useT()
  const { push, openQuick } = useNav()
  const s = data.state

  // Bleeding now: the card describes how long periods usually last.
  if (s.periodDay !== null && s.status !== 'withheld') {
    return (
      <section className="mz-section mz-card">
        <div className="mz-caption" style={{ marginBottom: 6 }}>{t('today.card.thisPeriod')}</div>
        <div className="mz-title">
          {s.periodLength
            ? t('today.card.usually', { min: s.periodLength.min, max: s.periodLength.max })
            : t('today.card.logEachDay')}
        </div>
        <button type="button" className="mz-link" style={{ marginTop: 10 }} onClick={() => push({ name: 'why' })}>
          {t('why.link')}
        </button>
      </section>
    )
  }

  if (s.status === 'withheld' && s.withheld) {
    const w = s.withdrawalBleed
    return (
      <section className="mz-section mz-card">
        {w ? (
          <>
            <div className="mz-spread" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div className="mz-caption" style={{ marginBottom: 6 }}>{t('today.card.withdrawal')}</div>
                <div className="mz-title">{dateRange(w.expected.start, w.expected.end, t.locale)}</div>
              </div>
              <span className="mz-pill">{w.daysUntil === 0 ? t('today.card.freeDaysNow') : t.n('estimate.inDays', w.daysUntil)}</span>
            </div>
            <p className="mz-body-sm mz-muted">{t(`today.card.withdrawalNote.${w.method}` as MessageKey)}</p>
          </>
        ) : (
          <>
            <div className="mz-title" style={{ marginBottom: 6 }}>{withheldTitle(s.withheld, t)}</div>
            <p className="mz-body-sm mz-muted">{withheldBody(s.withheld, t)}</p>
          </>
        )}
        <button type="button" className="mz-link" style={{ marginTop: 12 }} onClick={() => push({ name: 'why' })}>
          {t('why.link')}
        </button>
      </section>
    )
  }

  if (s.status === 'no-history' || s.status === 'stale') {
    return (
      <section className="mz-section mz-stack">
        <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => openQuick('flow', data.today)}>
          <Icon name="drop" size={20} />
          {t('today.card.logPeriodToday')}
        </button>
        <button type="button" className="mz-btn mz-btn--secondary mz-btn--block" onClick={() => useNav.getState().setTab('calendar')}>
          {t('today.card.addPastPeriod')}
        </button>
      </section>
    )
  }

  const range = rangeText(s, t)
  const countdown = countdownText(s, t)
  return (
    <section className="mz-section mz-card" aria-label={t('today.card.nextPeriod')}>
      <div className="mz-spread" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div className="mz-caption" style={{ marginBottom: 6 }}>{t('today.card.nextPeriod')}</div>
          {range ? (
            <div className="mz-title" aria-label={s.window && !s.displayInWeeks ? t('today.card.between', { range: betweenDates(s.window.start, s.window.end, t.locale) }) : range}>
              {range}
            </div>
          ) : (
            <div className="mz-body-sm mz-muted" style={{ maxWidth: '28ch' }}>{t('today.card.needTwo')}</div>
          )}
        </div>
        {countdown && <span className="mz-pill">{countdown}</span>}
      </div>
      {s.window && (
        <>
          <div style={{ marginBottom: 8 }}>
            <ConfidenceMeter level={s.confidence} />
          </div>
          <div className="mz-spread">
            <span className="mz-body-sm mz-muted" style={{ fontSize: 13 }}>
              {s.status === 'ok' ? confidenceLine(s, t) : t('today.card.roughGuess')}
            </span>
            <button type="button" className="mz-link" onClick={() => push({ name: 'why' })}>
              {t('why.link')}
            </button>
          </div>
        </>
      )}
      {!s.window && (
        <button type="button" className="mz-link" style={{ marginTop: 4 }} onClick={() => push({ name: 'why' })}>
          {t('why.link')}
        </button>
      )}
    </section>
  )
}
