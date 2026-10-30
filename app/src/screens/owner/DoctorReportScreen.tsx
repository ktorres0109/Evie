/**
 * Doctor summary: a printable page she can hand to a clinician. Built on the
 * same estimate as every other screen, so the numbers never disagree. Anything
 * sensitive (moods, intimacy, tests, pregnancy history) stays out unless she
 * turns it on for this report.
 */
import { useMemo, useState } from 'react'
import type { DailyLog } from '../../db/schema'
import { bleedingEpisodes, phaseAnalysisInput } from '../../engine/estimate'
import { daysBetween } from '../../engine/cycle'
import { symptomPhaseSummaries } from '../../engine/patterns'
import { useT, type MessageKey, type Translator } from '../../i18n'
import { dateRange, dayMonth, dayMonthShort } from '../../i18n/dates'
import { resolveRange, type DateRange, type RangePresetId } from '../../lib/dateRange'
import { exportCurrentReport } from '../../native/reportExport'
import { useNav } from '../../state/nav'
import type { CycleData } from '../../state/useCycle'
import { Icon } from '../../ui/icons'
import { Chip, Screen, SectionTitle, SwitchRow } from '../../ui/kit'
import { confidenceLine, exclusionText, lifeKindName, methodName, rangeText, withheldTitle } from './estimateText'
import { intimacyLabel, moodLabel, symptomLabel } from './labels'

const PRESETS: { id: Exclude<RangePresetId, 'custom'>; key: MessageKey }[] = [
  { id: 'last-3-months', key: 'doctor.range.3m' },
  { id: 'last-6-months', key: 'doctor.range.6m' },
  { id: 'last-12-months', key: 'doctor.range.12m' },
  { id: 'all', key: 'doctor.range.all' },
]

const PREGNANCY_KINDS = new Set(['pregnancy', 'pregnancy-ended', 'postpartum', 'breastfeeding'])

function count(rows: string[][]): { name: string; n: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) for (const v of new Set(r)) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mz-kv">
      <span className="mz-muted">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function inRange(date: string, r: DateRange) {
  return date >= r.start && date <= r.end
}

export function DoctorReportScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop } = useNav()
  const [preset, setPreset] = useState<Exclude<RangePresetId, 'custom'>>('last-6-months')
  const [moods, setMoods] = useState(false)
  const [intimacy, setIntimacy] = useState(false)
  const [tests, setTests] = useState(false)
  const [pregnancy, setPregnancy] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)

  const r = useMemo(() => {
    const range = resolveRange({
      preset,
      today: data.today,
      custom: { start: data.today, end: data.today },
      earliestEntry: data.logs[0]?.date ?? null,
    })
    const logs = data.logs.filter((l) => inRange(l.date, range))
    const s = data.state
    const cycles = [
      ...s.used.map((c) => ({ ...c, reason: null })),
      ...s.excluded,
    ]
      .filter((c) => c.end >= range.start && c.start <= range.end)
      .sort((a, b) => a.start.localeCompare(b.start))
    const periods = bleedingEpisodes(data.logs).filter((e) => e.end >= range.start && e.start <= range.end)
    const periodDays = periods.map((e) => daysBetween(e.start, e.end) + 1)
    const isHeavy = (l: DailyLog) => l.flow === 'heavy' || l.flow === 'very-heavy' || l.flow === 'clots'
    const inPeriod = (d: string) => periods.some((e) => d >= e.start && d <= e.end)
    const symptoms = count(logs.map((l) => l.symptoms ?? [])).slice(0, 10).map((x) => ({
      ...x,
      severe: logs.filter((l) => l.symptomRatings?.[x.name]?.severity === 'severe').length,
    }))
    const phase = phaseAnalysisInput(s, data.logs)
    const byPhase =
      phase.starts.length >= 2
        ? symptomPhaseSummaries(phase.logs.filter((l) => inRange(l.date, range)), phase.starts, 6)
        : []
    const regimens = data.regimens.filter((g) => !g.endDate || g.endDate >= range.start).filter((g) => g.startDate <= range.end)
    const life = data.lifeEvents
      .filter((e) => (!e.endDate || e.endDate >= range.start) && e.startDate <= range.end)
      .filter((e) => pregnancy || !PREGNANCY_KINDS.has(e.kind))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    return {
      range,
      loggedDays: new Set(logs.map((l) => l.date)).size,
      cycles,
      periodAvg: periodDays.length ? Math.round((periodDays.reduce((a, b) => a + b, 0) / periodDays.length) * 10) / 10 : null,
      heavyDays: logs.filter(isHeavy).length,
      veryHeavyDays: logs.filter((l) => l.flow === 'very-heavy').length,
      spottingBetween: logs.filter((l) => l.spotting && !inPeriod(l.date)).length,
      symptoms,
      byPhase,
      regimens,
      life,
      moods: count(logs.map((l) => l.moods ?? [])).slice(0, 8),
      intimacy: count(logs.map((l) => l.intimacyEvents ?? [])).slice(0, 8),
      tests: count(
        logs.map((l) => [
          ...(l.opk ? [`opk.${l.opk}`] : []),
          ...(l.pregnancyTest ? [`test.${l.pregnancyTest}`] : []),
        ]),
      ),
    }
  }, [data, preset, pregnancy])

  const s = data.state
  const estimate =
    s.status === 'withheld' && s.withheld
      ? withheldTitle(s.withheld, t)
      : s.status === 'ok'
        ? rangeText(s, t)
        : null

  async function exportReport() {
    setExportFailed(false)
    try {
      await exportCurrentReport(t('doctor.jobName'))
    } catch {
      setExportFailed(true)
    }
  }

  return (
    <Screen
      title={t('doctor.title')}
      onBack={pop}
      trailing={
        <button type="button" className="mz-icon-btn no-print" aria-label={t('doctor.export')} onClick={() => void exportReport()}>
          <Icon name="export" size={22} />
        </button>
      }
    >
      <div className="mz-doctor">
        <section className="mz-section">
          <h1 className="mz-title-lg">{t('doctor.heading')}</h1>
          <p className="mz-body-sm mz-muted">
            {t('doctor.generated', { date: dayMonth(data.today, t.locale) })} ·{' '}
            {t('doctor.covering', { range: dateRange(r.range.start, r.range.end, t.locale) })}
          </p>
        </section>

        <div className="mz-section mz-card no-print">
          <div className="mz-label" style={{ marginBottom: 10 }}>{t('doctor.rangeLabel')}</div>
          <div className="mz-chips" role="group" aria-label={t('doctor.rangeLabel')}>
            {PRESETS.map((p) => (
              <Chip key={p.id} selected={preset === p.id} onClick={() => setPreset(p.id)}>
                {t(p.key)}
              </Chip>
            ))}
          </div>
          <p className="mz-caption" style={{ marginTop: 10 }}>{t.n('doctor.loggedDays', r.loggedDays)}</p>
        </div>

        {exportFailed && (
          <p className="mz-section mz-body-sm no-print" role="alert">{t('doctor.exportFailed')}</p>
        )}

        <div className="no-print">
          <SectionTitle>{t('doctor.include')}</SectionTitle>
        </div>
        <div className="mz-section mz-list no-print">
          <SwitchRow title={t('doctor.inc.moods')} checked={moods} onChange={setMoods} />
          <SwitchRow title={t('doctor.inc.intimacy')} checked={intimacy} onChange={setIntimacy} />
          <SwitchRow title={t('doctor.inc.tests')} checked={tests} onChange={setTests} />
          <SwitchRow title={t('doctor.inc.pregnancy')} sub={t('doctor.inc.pregnancySub')} checked={pregnancy} onChange={setPregnancy} />
        </div>

        <SectionTitle>{t('doctor.cycle')}</SectionTitle>
        <div className="mz-section mz-card">
          <Row label={t('doctor.nextPeriod')} value={estimate ?? t('doctor.notEnough')} />
          {s.status === 'ok' && <Row label={t('doctor.confidence')} value={confidenceLine(s, t)} />}
          {s.medianLength !== null && <Row label={t('doctor.typical')} value={t.n('common.days', Math.round(s.medianLength))} />}
          {s.spreadDays !== null && <Row label={t('doctor.variation')} value={t.n('why.plusMinus', s.spreadDays)} />}
          {r.periodAvg !== null && <Row label={t('doctor.periodAvg')} value={t('doctor.daysDecimal', { n: r.periodAvg })} />}
          <Row label={t('doctor.heavyDays')} value={t('doctor.heavyValue', { n: r.heavyDays, v: r.veryHeavyDays })} />
          <Row label={t('doctor.spotting')} value={String(r.spottingBetween)} />
          <Row label={t('doctor.method')} value={s.method ? methodName(s.method, t) : t('doctor.methodUnset')} />
        </div>

        {r.cycles.length > 0 && (
          <>
            <SectionTitle>{t('doctor.cycles')}</SectionTitle>
            <div className="mz-section mz-card">
              <table className="mz-table">
                <thead>
                  <tr>
                    <th>{t('doctor.col.start')}</th>
                    <th>{t('doctor.col.length')}</th>
                    <th>{t('doctor.col.note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.cycles.map((c) => (
                    <tr key={c.start}>
                      <td>{dayMonthShort(c.start, t.locale)}</td>
                      <td>{t.n('common.days', c.length)}</td>
                      <td className="mz-muted">{c.reason ? exclusionText(c.reason, t) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(r.regimens.length > 0 || r.life.length > 0) && (
          <>
            <SectionTitle>{t('doctor.context')}</SectionTitle>
            <div className="mz-section mz-card">
              {r.regimens.map((g) => (
                <Row key={g.id} label={methodName(g.method, t)} value={spanText(g.startDate, g.endDate, t)} />
              ))}
              {r.life.map((e) => (
                <Row key={e.id} label={lifeKindName(e.kind, t)} value={spanText(e.startDate, e.endDate, t)} />
              ))}
              <p className="mz-caption" style={{ marginTop: 8 }}>{t('doctor.selfReported')}</p>
            </div>
          </>
        )}

        <SectionTitle>{t('doctor.symptoms')}</SectionTitle>
        <div className="mz-section mz-card">
          {r.symptoms.length === 0 ? (
            <p className="mz-body-sm mz-muted">{t('doctor.none')}</p>
          ) : (
            r.symptoms.map((x) => (
              <Row
                key={x.name}
                label={symptomLabel(x.name, t)}
                value={x.severe ? t('doctor.daysSevere', { n: x.n, s: x.severe }) : t.n('common.days', x.n)}
              />
            ))
          )}
        </div>

        {r.byPhase.length > 0 && (
          <>
            <SectionTitle>{t('doctor.byPhase')}</SectionTitle>
            <div className="mz-section mz-card">
              {r.byPhase.map((p) => (
                <Row
                  key={p.signal}
                  label={`${symptomLabel(p.signal, t)} · ${t(`phaseName.${p.phase}` as MessageKey)}`}
                  value={t('doctor.ofCheckIns', { n: p.occurrences, total: p.completedCheckInsInPhase })}
                />
              ))}
            </div>
          </>
        )}

        {moods && (
          <Optional title={t('doctor.inc.moods')} rows={r.moods.map((x) => [moodLabel(x.name, t), x.n])} t={t} />
        )}
        {intimacy && (
          <Optional title={t('doctor.inc.intimacy')} rows={r.intimacy.map((x) => [intimacyLabel(x.name, t), x.n])} t={t} />
        )}
        {tests && (
          <Optional
            title={t('doctor.inc.tests')}
            rows={r.tests.map((x) => [`${t(x.name.startsWith('opk') ? 'log.opk' : 'log.pregnancyTest')}: ${t(x.name as MessageKey)}`, x.n])}
            t={t}
          />
        )}

        <div className="mz-section mz-card mz-card--raised">
          <p className="mz-body-sm mz-muted">{t('doctor.method.note')}</p>
          <p className="mz-body-sm mz-muted" style={{ marginTop: 8 }}>{t('doctor.disclaimer')}</p>
        </div>
      </div>
    </Screen>
  )
}

function spanText(start: string, end: string | undefined, t: Translator): string {
  return end ? dateRange(start, end, t.locale, true) : t('doctor.since', { date: dayMonthShort(start, t.locale) })
}

function Optional({ title, rows, t }: { title: string; rows: [string, number][]; t: Translator }) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <div className="mz-section mz-card">
        {rows.length === 0 ? (
          <p className="mz-body-sm mz-muted">{t('doctor.none')}</p>
        ) : (
          rows.map(([label, n]) => <Row key={label} label={label} value={t.n('common.days', n)} />)
        )}
      </div>
    </>
  )
}
