/**
 * Owner — log (spec §5.3). One scrolling surface ordered by how often each
 * field is touched. Every control writes immediately; "Done for today" only
 * marks the check-in complete and closes. Also the quick one-category half
 * sheets opened from Today's quick-log row.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { bleedingOf, getLog, patchLog, setBleeding, symptomUsage, toggleIn, wouldStartPeriod, type BleedingChoice } from '../../db/logs'
import { db, MOOD_WORDS, type DailyLog, type Discharge, type IntimacyEvent } from '../../db/schema'
import { SYMPTOMS } from '../../db/taxonomy'
import { activeRegimenOn, missedDoseId, type RegimenRecord } from '../../db/regimen'
import { getCycleDay } from '../../engine/cycle'
import { periodStartsFromLogs } from '../../engine/estimate'
import { evaluateSafetyTriage, type SafetyUrgency } from '../../engine/safety'
import { useT, type MessageKey } from '../../i18n'
import { weekdayLong } from '../../i18n/dates'
import { localToday } from '../../lib/dates'
import { useNav, type QuickKind } from '../../state/nav'
import { Icon } from '../../ui/icons'
import { Banner, Chip, SavedStrip, Segment, Sheet } from '../../ui/kit'
import { COMMON_SYMPTOMS, DISCHARGE_IDS, INTIMACY_IDS, PAIN_SYMPTOMS, dischargeLabel, intimacyLabel, moodLabel, symptomLabel } from './labels'

function useLog(date: string): DailyLog | undefined {
  return useLiveQuery(() => getLog(date), [date])
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

const FLOW_OPTIONS: { id: BleedingChoice; short: MessageKey; long: MessageKey }[] = [
  { id: 'none', short: 'flow.none', long: 'flow.none' },
  { id: 'spotting', short: 'flow.spotting.short', long: 'flow.spotting' },
  { id: 'light', short: 'flow.light', long: 'flow.light' },
  { id: 'medium', short: 'flow.medium.short', long: 'flow.medium' },
  { id: 'heavy', short: 'flow.heavy', long: 'flow.heavy' },
  { id: 'very-heavy', short: 'flow.veryHeavy.short', long: 'flow.veryHeavy' },
]

function FlowPicker({ date, log, onCommitted }: { date: string; log: DailyLog | undefined; onCommitted?: () => void }) {
  const t = useT()
  const [askStart, setAskStart] = useState<BleedingChoice | null>(null)
  const [heavyCheck, setHeavyCheck] = useState(false)
  const value = bleedingOf(log)

  async function choose(choice: BleedingChoice) {
    if (choice === value) {
      await setBleeding(date, undefined)
      return
    }
    const isPeriodFlow = choice !== 'none' && choice !== 'spotting'
    if (isPeriodFlow && !log?.flow && (await wouldStartPeriod(date))) {
      setAskStart(choice)
      return
    }
    await setBleeding(date, choice)
    if (choice === 'very-heavy') setHeavyCheck(true)
    else onCommitted?.()
  }

  return (
    <div className="mz-stack" style={{ gap: 10 }}>
      <Segment
        label={t('log.flow')}
        value={value}
        onChange={(v) => void choose(v)}
        options={FLOW_OPTIONS.map((o) => ({ id: o.id, label: t(o.short), long: t(o.long) }))}
      />
      {askStart && (
        <div className="mz-card mz-card--sm mz-card--raised mz-stack" role="group" aria-label={t('log.startQuestion')}>
          <strong style={{ fontWeight: 500 }}>{t('log.startQuestion')}</strong>
          <p className="mz-body-sm mz-muted">{t('log.startHelp')}</p>
          <div className="mz-row">
            <button
              type="button"
              className="mz-btn mz-btn--primary mz-grow"
              data-autofocus
              onClick={async () => {
                const choice = askStart
                setAskStart(null)
                await setBleeding(date, choice)
                if (choice === 'very-heavy') setHeavyCheck(true)
                else onCommitted?.()
              }}
            >
              {t('log.startYes')}
            </button>
            <button
              type="button"
              className="mz-btn mz-btn--secondary mz-grow"
              onClick={async () => {
                setAskStart(null)
                await setBleeding(date, 'spotting')
                onCommitted?.()
              }}
            >
              {t('log.startNo')}
            </button>
          </div>
        </div>
      )}
      {heavyCheck && <HeavyBleedingCheck onDone={() => { setHeavyCheck(false); onCommitted?.() }} />}
    </div>
  )
}

/** Two quick questions after "very heavy"; routes to care, never reassures. */
function HeavyBleedingCheck({ onDone }: { onDone: () => void }) {
  const t = useT()
  const [soaking, setSoaking] = useState<boolean | null>(null)
  const [systemic, setSystemic] = useState<boolean | null>(null)
  const urgency: SafetyUrgency | null =
    soaking === null
      ? null
      : evaluateSafetyTriage({
          bleeding: {
            soakedProductsPerHour: soaking ? 1 : 0,
            consecutiveHours: soaking ? 2 : 0,
            dizziness: systemic === true,
          },
        }).urgency
  return (
    <div className="mz-card mz-card--sm mz-card--raised mz-stack">
      <strong style={{ fontWeight: 500 }}>{t('safety.heavy.q1')}</strong>
      <div className="mz-row">
        <Chip selected={soaking === true} onClick={() => setSoaking(true)}>{t('common.yes')}</Chip>
        <Chip selected={soaking === false} onClick={() => setSoaking(false)}>{t('common.no')}</Chip>
      </div>
      {soaking && (
        <>
          <strong style={{ fontWeight: 500 }}>{t('safety.heavy.q2')}</strong>
          <div className="mz-row">
            <Chip selected={systemic === true} onClick={() => setSystemic(true)}>{t('common.yes')}</Chip>
            <Chip selected={systemic === false} onClick={() => setSystemic(false)}>{t('common.no')}</Chip>
          </div>
        </>
      )}
      {urgency && urgency !== 'none' && <SafetyBanner urgency={urgency} />}
      {urgency === 'none' && <p className="mz-body-sm mz-muted">{t('safety.noneMatched')}</p>}
      <button type="button" className="mz-btn mz-btn--ghost" onClick={onDone}>
        {t('common.continue')}
      </button>
    </div>
  )
}

export function SafetyBanner({ urgency }: { urgency: Exclude<SafetyUrgency, 'none'> }) {
  const t = useT()
  return (
    <Banner tone="critical" icon="warning-octagon:fill" title={t(`safety.${urgency}.title` as MessageKey)} role="alert">
      <span style={{ display: 'block', marginBottom: 6 }}>{t(`safety.${urgency}.action` as MessageKey)}</span>
      <span className="mz-caption" style={{ display: 'block', color: 'inherit', opacity: 0.8 }}>
        {t('safety.caveat')}
      </span>
    </Banner>
  )
}

// ---------------------------------------------------------------------------
// Symptoms, mood, discharge
// ---------------------------------------------------------------------------

function SymptomPicker({ date, log, options }: { date: string; log: DailyLog | undefined; options?: string[] }) {
  const t = useT()
  const [all, setAll] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  // Ordering uses history before this month only, so chips never jump mid-session.
  const usage = useLiveQuery(async () => {
    const monthStart = `${localToday().slice(0, 7)}-01`
    return symptomUsage(await db.dailyLogs.where('date').below(monthStart).toArray())
  }, [])
  const ordered = useMemo(() => {
    if (options) return options
    const base = [...COMMON_SYMPTOMS]
    const rest = (SYMPTOMS as readonly string[]).filter((s) => !base.includes(s))
    if (usage && usage.size) {
      const byUse = [...(SYMPTOMS as readonly string[])].sort((a, b) => (usage.get(b) ?? 0) - (usage.get(a) ?? 0))
      const top = byUse.filter((s) => (usage.get(s) ?? 0) > 0).slice(0, 7)
      const fill = base.filter((s) => !top.includes(s)).slice(0, 7 - top.length)
      const first = [...top, ...fill]
      return [...first, ...(SYMPTOMS as readonly string[]).filter((s) => !first.includes(s))]
    }
    return [...base, ...rest]
  }, [usage, options])
  const selected = log?.symptoms ?? []
  const visible = all || options ? ordered : ordered.slice(0, 7)
  const hidden = ordered.length - visible.length

  return (
    <>
      <div className="mz-chips" role="group" aria-label={t.n('log.symptomsSelected', selected.length)}>
        {visible.map((s) => (
          <Chip
            key={s}
            selected={selected.includes(s)}
            onClick={() => void patchLog(date, (l) => ({ symptoms: toggleIn(l.symptoms, s) }))}
            onLongPress={() => setDetail(s)}
          >
            {symptomLabel(s, t)}
          </Chip>
        ))}
        {hidden > 0 && (
          <Chip more onClick={() => setAll(true)}>
            {t('log.moreSymptoms', { n: hidden })}
          </Chip>
        )}
      </div>
      {detail && <SymptomDetail date={date} symptom={detail} log={log} onClose={() => setDetail(null)} />}
    </>
  )
}

function SymptomDetail({ date, symptom, log, onClose }: { date: string; symptom: string; log: DailyLog | undefined; onClose: () => void }) {
  const t = useT()
  const rating = log?.symptomRatings?.[symptom] ?? {}
  const set = (patch: Record<string, string>) =>
    patchLog(date, (l) => ({
      symptoms: (l.symptoms ?? []).includes(symptom) ? l.symptoms : [...(l.symptoms ?? []), symptom],
      symptomRatings: { ...(l.symptomRatings ?? {}), [symptom]: { ...(l.symptomRatings?.[symptom] ?? {}), ...patch } },
    }))
  return (
    <Sheet title={symptomLabel(symptom, t)} onClose={onClose}>
      <div className="mz-stack" style={{ gap: 16 }}>
        <div className="mz-field">
          <span className="mz-field__label">{t('log.severity')}</span>
          <Segment
            label={t('log.severity')}
            value={rating.severity}
            onChange={(v) => void set({ severity: v })}
            options={(['mild', 'moderate', 'severe'] as const).map((id) => ({ id, label: t(`severity.${id}`) }))}
          />
        </div>
        <div className="mz-field">
          <span className="mz-field__label">{t('log.impact')}</span>
          <Segment
            label={t('log.impact')}
            value={rating.impairment}
            onChange={(v) => void set({ impairment: v })}
            options={(['none', 'noticeable', 'limited-routine'] as const).map((id) => ({ id, label: t(`impact.${id}`) }))}
          />
        </div>
      </div>
    </Sheet>
  )
}

function MoodPicker({ date, log }: { date: string; log: DailyLog | undefined }) {
  const t = useT()
  const moods = log?.moods ?? []
  return (
    <div className="mz-chips" role="group" aria-label={t('log.mood')}>
      {MOOD_WORDS.map((m) => (
        <Chip key={m} selected={moods.includes(m)} onClick={() => void patchLog(date, (l) => ({ moods: toggleIn(l.moods, m) }))}>
          {moodLabel(m, t)}
        </Chip>
      ))}
    </div>
  )
}

function DischargePicker({ date, log, onCommitted }: { date: string; log: DailyLog | undefined; onCommitted?: () => void }) {
  const t = useT()
  return (
    <div className="mz-chips" role="radiogroup" aria-label={t('log.discharge')}>
      {DISCHARGE_IDS.map((d) => (
        <Chip
          key={d}
          selected={log?.discharge === d}
          onClick={async () => {
            await patchLog(date, { discharge: log?.discharge === d ? undefined : (d as Discharge) })
            onCommitted?.()
          }}
        >
          {dischargeLabel(d, t)}
        </Chip>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BBT / OPK
// ---------------------------------------------------------------------------

function BbtSheet({ date, log, onClose }: { date: string; log: DailyLog | undefined; onClose: () => void }) {
  const t = useT()
  const [unit, setUnit] = useState<'c' | 'f'>(() => (t.locale === 'en' ? 'f' : 'c'))
  const initial = log?.bbt !== undefined ? (unit === 'c' ? log.bbt / 100 : (log.bbt / 100) * 1.8 + 32) : undefined
  const [text, setText] = useState(initial !== undefined ? initial.toFixed(2) : '')
  const own = useLiveQuery(async () => {
    const all = await db.dailyLogs.filter((l) => l.bbt !== undefined && l.date !== date).toArray()
    return all.map((l) => l.bbt!).sort((a, b) => a - b)
  }, [date])
  const value = Number(text.replace(',', '.'))
  const celsius = Number.isFinite(value) && text ? (unit === 'c' ? value : (value - 32) / 1.8) : null
  const plausible = celsius !== null && celsius >= 34 && celsius <= 39.5
  // Flag readings well outside this person's own range (about 1.5 °F / 0.8 °C),
  // not a population range.
  const c100 = celsius === null ? 0 : Math.round(celsius * 100)
  const outsideOwn = plausible && own && own.length >= 6 ? c100 < own[0] - 80 || c100 > own.at(-1)! + 80 : false
  const errorId = 'bbt-error'
  return (
    <Sheet
      title={t('log.bbt')}
      onClose={onClose}
      footer={
        <div className="mz-row">
          {log?.bbt !== undefined && (
            <button type="button" className="mz-btn mz-btn--secondary" onClick={async () => { await patchLog(date, { bbt: undefined }, ['bbt']); onClose() }}>
              {t('common.remove')}
            </button>
          )}
          <button
            type="button"
            className="mz-btn mz-btn--primary mz-grow"
            disabled={!plausible}
            onClick={async () => {
              await patchLog(date, { bbt: Math.round(celsius! * 100) }, ['bbt'])
              onClose()
            }}
          >
            {t('common.save')}
          </button>
        </div>
      }
    >
      <div className="mz-stack" style={{ gap: 14 }}>
        <div className="mz-row">
          <input
            className="mz-input mz-grow"
            inputMode="decimal"
            aria-label={t('log.bbtInput', { unit: unit === 'c' ? '°C' : '°F' })}
            aria-invalid={Boolean(text) && !plausible}
            aria-describedby={errorId}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder={unit === 'c' ? '36.50' : '97.70'}
            data-autofocus
          />
          <Segment
            label={t('log.bbtUnit')}
            value={unit}
            onChange={(u) => {
              if (celsius !== null) setText((u === 'c' ? celsius : celsius * 1.8 + 32).toFixed(2))
              setUnit(u)
            }}
            options={[
              { id: 'c', label: '°C' },
              { id: 'f', label: '°F' },
            ]}
          />
        </div>
        <div id={errorId}>
          {Boolean(text) && !plausible && <p className="mz-field__error">{t('log.bbtImplausible')}</p>}
          {outsideOwn && <p className="mz-field__help">{t('log.bbtOutsideOwn')}</p>}
        </div>
        <p className="mz-caption">{t('log.bbtLimit')}</p>
      </div>
    </Sheet>
  )
}

function OpkSheet({ date, log, onClose }: { date: string; log: DailyLog | undefined; onClose: () => void }) {
  const t = useT()
  return (
    <Sheet title={t('log.opk')} onClose={onClose}>
      <div className="mz-stack" style={{ gap: 14 }}>
        <Segment
          label={t('log.opk')}
          value={log?.opk}
          onChange={async (v) => {
            await patchLog(date, { opk: log?.opk === v ? undefined : v }, ['opk'])
            onClose()
          }}
          options={[
            { id: 'positive', label: t('opk.positive') },
            { id: 'negative', label: t('opk.negative') },
          ]}
        />
        <p className="mz-caption">{t('log.opkLimit')}</p>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Intimacy & contraception (behind one tap)
// ---------------------------------------------------------------------------

function IntimacySheet({ date, log, onClose }: { date: string; log: DailyLog | undefined; onClose: () => void }) {
  const t = useT()
  const regimen = useLiveQuery(async () => activeRegimenOn(await db.regimenRecords.toArray(), date), [date])
  const missed = useLiveQuery(
    async () => (regimen ? db.missedDoseEvents.get(missedDoseId(regimen.id, date)) : undefined),
    [regimen?.id, date],
  )
  const ec = useLiveQuery(() => db.lifeEvents.where('startDate').equals(date).filter((e) => e.kind === 'emergency-contraception').first(), [date])
  const events = log?.intimacyEvents ?? []
  const isPill = regimen && (regimen.config?.kind === 'pill' || regimen.method === 'progestin-only-pill')

  return (
    <Sheet title={t('log.intimacy')} onClose={onClose}>
      <div className="mz-stack" style={{ gap: 18 }}>
        <div className="mz-field">
          <span className="mz-field__label">{t('log.intimacyWhat')}</span>
          <div className="mz-chips">
            {INTIMACY_IDS.map((id) => (
              <Chip
                key={id}
                selected={events.includes(id)}
                onClick={() =>
                  void patchLog(date, (l) => ({ intimacyEvents: toggleIn<IntimacyEvent>(l.intimacyEvents, id), sex: undefined }))
                }
              >
                {intimacyLabel(id, t)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mz-field">
          <span className="mz-field__label">{t('log.pregnancyTest')}</span>
          <Segment
            label={t('log.pregnancyTest')}
            value={log?.pregnancyTest === 'not-taken' ? undefined : log?.pregnancyTest}
            onChange={(v) => void patchLog(date, { pregnancyTest: log?.pregnancyTest === v ? undefined : v })}
            options={(['negative', 'faint', 'positive'] as const).map((id) => ({ id, label: t(`test.${id}`) }))}
          />
          {log?.pregnancyTest === 'positive' && <p className="mz-field__help">{t('log.positiveTestHelp')}</p>}
        </div>

        <div className="mz-list">
          <button
            type="button"
            className="mz-list-row"
            aria-pressed={Boolean(ec)}
            onClick={async () => {
              if (ec) await db.lifeEvents.delete(ec.id)
              else
                await db.lifeEvents.put({
                  id: `ec-${date}`,
                  kind: 'emergency-contraception',
                  startDate: date,
                  createdAt: new Date().toISOString(),
                })
            }}
          >
            <Icon name="pill" size={22} className="mz-list-row__icon" />
            <span className="mz-list-row__text">
              <span className="mz-list-row__title">{t('log.ecTaken')}</span>
              <span className="mz-list-row__sub">{t('log.ecHelp')}</span>
            </span>
            <span className="mz-list-row__end">{ec ? <Icon name="check" size={20} style={{ color: 'var(--care)' }} /> : null}</span>
          </button>
          {isPill && regimen && (
            <MissedPillRow date={date} regimen={regimen} missed={Boolean(missed)} />
          )}
        </div>
        <p className="mz-caption">{t('log.intimacyPrivate')}</p>
      </div>
    </Sheet>
  )
}

function MissedPillRow({ date, regimen, missed }: { date: string; regimen: RegimenRecord; missed: boolean }) {
  const t = useT()
  return (
    <button
      type="button"
      className="mz-list-row"
      aria-pressed={missed}
      onClick={async () => {
        const id = missedDoseId(regimen.id, date)
        if (missed) await db.missedDoseEvents.delete(id)
        else await db.missedDoseEvents.put({ id, regimenId: regimen.id, date, kind: 'skipped', recordedAt: new Date().toISOString() })
      }}
    >
      <Icon name="clock" size={22} className="mz-list-row__icon" />
      <span className="mz-list-row__text">
        <span className="mz-list-row__title">{t('log.missedPill')}</span>
        <span className="mz-list-row__sub">{t('log.missedPillHelp')}</span>
      </span>
      <span className="mz-list-row__end">{missed ? <Icon name="check" size={20} style={{ color: 'var(--care)' }} /> : null}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function NotesField({ date, log }: { date: string; log: DailyLog | undefined }) {
  const t = useT()
  const [text, setText] = useState(log?.notes ?? '')
  const timer = useRef<number | undefined>(undefined)
  const loaded = useRef(false)
  useEffect(() => {
    if (!loaded.current && log) {
      setText(log.notes ?? '')
      loaded.current = true
    }
  }, [log])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <textarea
      className="mz-textarea"
      aria-label={t('log.notes')}
      placeholder={t('log.notesPlaceholder')}
      value={text}
      onChange={(e) => {
        const value = e.currentTarget.value
        setText(value)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => void patchLog(date, { notes: value.trim() ? value : undefined }), 400)
      }}
      onBlur={() => void patchLog(date, { notes: text.trim() ? text : undefined })}
    />
  )
}

// ---------------------------------------------------------------------------
// Full log sheet
// ---------------------------------------------------------------------------

export function LogSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const t = useT()
  const log = useLog(date)
  const { push } = useNav()
  const [sub, setSub] = useState<'bbt' | 'opk' | 'intimacy' | null>(null)
  const starts = useLiveQuery(async () => periodStartsFromLogs(await db.dailyLogs.toArray()), [])
  const cycleDay = starts ? getCycleDay(starts, date, localToday()) : null
  const symptomCount = log?.symptoms?.length ?? 0

  async function done() {
    await patchLog(date, { checkInComplete: true })
    onClose()
  }

  const bbtText =
    log?.bbt !== undefined
      ? t.locale === 'en'
        ? `${((log.bbt / 100) * 1.8 + 32).toFixed(2)} °F`
        : `${(log.bbt / 100).toFixed(2)} °C`
      : t('log.addReading')

  return (
    <Sheet
      full
      title={weekdayLong(date, t.locale)}
      subtitle={cycleDay ? t('log.cycleDay', { n: cycleDay }) : undefined}
      onClose={onClose}
      footer={
        <div className="mz-stack" style={{ gap: 12 }}>
          <SavedStrip text={t('log.savedOffline')} />
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => void done()}>
            {t('log.doneForToday')}
          </button>
        </div>
      }
    >
      <div className="mz-stack" style={{ gap: 20 }}>
        <section>
          <h3 className="mz-caption" style={{ margin: '0 0 10px', fontWeight: 400 }}>{t('log.flow')}</h3>
          <FlowPicker date={date} log={log} />
        </section>

        <section>
          <div className="mz-spread" style={{ marginBottom: 10 }}>
            <h3 className="mz-caption" style={{ margin: 0, fontWeight: 400 }}>{t('log.symptoms')}</h3>
            {symptomCount > 0 && <span className="mz-caption mz-accent">{t.n('log.symptomsSelected', symptomCount)}</span>}
          </div>
          <SymptomPicker date={date} log={log} />
          <p className="mz-caption" style={{ marginTop: 8 }}>{t('log.longPressHint')}</p>
        </section>

        <section>
          <h3 className="mz-caption" style={{ margin: '0 0 10px', fontWeight: 400 }}>{t('log.mood')}</h3>
          <MoodPicker date={date} log={log} />
        </section>

        <section>
          <h3 className="mz-caption" style={{ margin: '0 0 10px', fontWeight: 400 }}>{t('log.discharge')}</h3>
          <DischargePicker date={date} log={log} />
        </section>

        <section>
          <button type="button" className="mz-card mz-card--sm mz-card--button mz-spread" onClick={() => setSub('intimacy')}>
            <span className="mz-row">
              <Icon name="heart" size={20} className="mz-muted" />
              <span style={{ fontSize: 15 }}>{t('log.intimacy')}</span>
            </span>
            <Icon name="caret-right" size={16} className="mz-faint" />
          </button>
          <p className="mz-caption" style={{ margin: '8px 2px 0' }}>{t('log.intimacyPrivate')}</p>
        </section>

        <section className="mz-row" style={{ gap: 10, alignItems: 'stretch' }}>
          <button type="button" className="mz-card mz-card--sm mz-card--button mz-grow" onClick={() => setSub('bbt')}>
            <span className="mz-caption" style={{ display: 'block', marginBottom: 6 }}>{t('log.bbt')}</span>
            <span style={{ fontSize: 15, color: log?.bbt !== undefined ? 'var(--text)' : 'var(--text-2)' }}>{bbtText}</span>
          </button>
          <button type="button" className="mz-card mz-card--sm mz-card--button mz-grow" onClick={() => setSub('opk')}>
            <span className="mz-caption" style={{ display: 'block', marginBottom: 6 }}>{t('log.opk')}</span>
            <span style={{ fontSize: 15, color: log?.opk ? 'var(--text)' : 'var(--text-2)' }}>
              {log?.opk ? t(`opk.${log.opk}`) : t('log.addResult')}
            </span>
          </button>
        </section>

        <section>
          <NotesField date={date} log={log} />
        </section>

        <section>
          <button
            type="button"
            className="mz-card mz-card--sm mz-card--button mz-spread"
            onClick={() => {
              onClose()
              push({ name: 'life' })
            }}
          >
            <span className="mz-row">
              <Icon name="list-checks" size={20} className="mz-muted" />
              <span>
                <span style={{ display: 'block', fontSize: 15 }}>{t('log.lifeRow')}</span>
                <span className="mz-caption" style={{ display: 'block' }}>{t('log.lifeRowSub')}</span>
              </span>
            </span>
            <Icon name="caret-right" size={16} className="mz-faint" />
          </button>
        </section>
      </div>

      {sub === 'bbt' && <BbtSheet date={date} log={log} onClose={() => setSub(null)} />}
      {sub === 'opk' && <OpkSheet date={date} log={log} onClose={() => setSub(null)} />}
      {sub === 'intimacy' && <IntimacySheet date={date} log={log} onClose={() => setSub(null)} />}
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Quick sheets (one category, commit on selection, close)
// ---------------------------------------------------------------------------

export function QuickSheet({ kind, date, onClose }: { kind: QuickKind; date: string; onClose: () => void }) {
  const t = useT()
  const log = useLog(date)
  const titles: Record<QuickKind, MessageKey> = {
    flow: 'log.flow',
    mood: 'log.mood',
    pain: 'log.pain',
    discharge: 'log.discharge',
  }
  const multi = kind === 'mood' || kind === 'pain'
  return (
    <Sheet
      title={t(titles[kind])}
      subtitle={weekdayLong(date, t.locale)}
      onClose={onClose}
      footer={
        multi ? (
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={onClose}>
            {t('common.done')}
          </button>
        ) : undefined
      }
    >
      {kind === 'flow' && <FlowPicker date={date} log={log} onCommitted={onClose} />}
      {kind === 'mood' && <MoodPicker date={date} log={log} />}
      {kind === 'pain' && <SymptomPicker date={date} log={log} options={PAIN_SYMPTOMS} />}
      {kind === 'discharge' && <DischargePicker date={date} log={log} onCommitted={onClose} />}
      <div style={{ marginTop: 16 }}>
        <SavedStrip text={t('log.savedOffline')} />
      </div>
    </Sheet>
  )
}
