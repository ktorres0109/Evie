/**
 * Owner — Insights. Cycle-length and period-length trends (static SVG with a
 * "View as table" control), symptom-by-phase associations with their evidence,
 * the data-confidence meter, and the methodology.
 */
import { useMemo, useState } from 'react'
import { bleedingEpisodes } from '../../engine/estimate'
import { symptomPhaseSummaries } from '../../engine/patterns'
import { daysBetween } from '../../engine/cycle'
import { useT, type MessageKey } from '../../i18n'
import { dayMonthShort } from '../../i18n/dates'
import { useNav } from '../../state/nav'
import type { CycleData } from '../../state/useCycle'
import { ConfidenceMeter, ListRow, SectionTitle } from '../../ui/kit'
import { confidenceLine } from './estimateText'
import { symptomLabel } from './labels'

function LengthChart({ points, label }: { points: { label: string; value: number; excluded?: boolean }[]; label: string }) {
  const t = useT()
  const [table, setTable] = useState(false)
  if (points.length === 0) return <p className="mz-body-sm mz-muted">{t('insights.noData')}</p>
  const max = Math.max(...points.map((p) => p.value))
  const w = 320
  const h = 120
  const bw = Math.min(28, (w - 20) / points.length - 6)
  // Bars start at zero so their heights compare honestly.
  const y = (v: number) => h - 18 - (v / max) * (h - 34)
  return (
    <div className="mz-stack" style={{ gap: 8 }}>
      {table ? (
        <table className="mz-table">
          <thead>
            <tr>
              <th>{t('insights.table.ending')}</th>
              <th>{t('insights.table.length')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td>
                  {t.n('common.days', p.value)}
                  {p.excluded ? ` · ${t('insights.leftOut')}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="mz-chart" role="img" aria-label={label}>
          {points.map((p, i) => {
            const x = 10 + i * ((w - 20) / points.length) + 3
            return (
              <g key={p.label}>
                <rect
                  x={x}
                  y={y(p.value)}
                  width={bw}
                  height={h - 18 - y(p.value)}
                  rx={4}
                  fill={p.excluded ? 'none' : 'var(--primary)'}
                  stroke={p.excluded ? 'var(--text-3)' : 'none'}
                  strokeDasharray={p.excluded ? '3 3' : undefined}
                />
                <text x={x + bw / 2} y={y(p.value) - 4} textAnchor="middle">
                  {p.value}
                </text>
                <text x={x + bw / 2} y={h - 4} textAnchor="middle">
                  {p.label.split(' ')[0]}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <button type="button" className="mz-link" onClick={() => setTable(!table)}>
        {table ? t('insights.viewChart') : t('insights.viewTable')}
      </button>
    </div>
  )
}

export function InsightsTab({ data }: { data: CycleData }) {
  const t = useT()
  const { push } = useNav()
  const s = data.state

  const cyclePoints = useMemo(() => {
    const all = [
      ...s.used.map((c) => ({ ...c, excluded: false })),
      ...s.excluded.map((c) => ({ ...c, excluded: true })),
    ].sort((a, b) => a.start.localeCompare(b.start))
    return all.slice(-8).map((c) => ({ label: dayMonthShort(c.end, t.locale), value: c.length, excluded: c.excluded }))
  }, [s.used, s.excluded, t.locale])

  const periodPoints = useMemo(
    () =>
      bleedingEpisodes(data.logs)
        .filter((e) => daysBetween(e.end, data.today) >= 2)
        .slice(-8)
        .map((e) => ({ label: dayMonthShort(e.start, t.locale), value: daysBetween(e.start, e.end) + 1 })),
    [data.logs, data.today, t.locale],
  )

  const phases = useMemo(() => {
    const starts = [...new Set([...s.used.map((c) => c.start), ...(s.lastPeriodStart ? [s.lastPeriodStart] : [])])].sort()
    if (starts.length < 2) return []
    // One row per signal, showing the phase where it was logged most often.
    const bySignal = new Map<string, { signal: string; phase: string; rate: number; occurrences: number }>()
    for (const row of symptomPhaseSummaries(data.logs, starts, 6)) {
      const prev = bySignal.get(row.signal)
      const occurrences = (prev?.occurrences ?? 0) + row.occurrences
      if (!prev || row.rate > prev.rate) bySignal.set(row.signal, { signal: row.signal, phase: row.phase, rate: row.rate, occurrences })
      else prev.occurrences = occurrences
    }
    return [...bySignal.values()]
  }, [data.logs, s.used, s.lastPeriodStart])

  return (
    <div className="mz-page">
      <header className="mz-appbar">
        <h1 className="mz-h1">{t('nav.insights')}</h1>
      </header>

      <section className="mz-section mz-card">
        <div className="mz-label" style={{ marginBottom: 10 }}>{t('insights.dataConfidence')}</div>
        <ConfidenceMeter level={s.confidence} />
        <p className="mz-body-sm mz-muted" style={{ marginTop: 8 }}>
          {s.status === 'ok' ? confidenceLine(s, t) : t('insights.confidenceLearning')}
        </p>
        <button type="button" className="mz-link" style={{ marginTop: 10 }} onClick={() => push({ name: 'why' })}>
          {t('why.link')}
        </button>
      </section>

      <SectionTitle>{t('insights.cycleLength')}</SectionTitle>
      <section className="mz-section mz-card">
        <LengthChart points={cyclePoints} label={t('insights.cycleLengthAria')} />
        {s.excluded.length > 0 && <p className="mz-caption" style={{ marginTop: 8 }}>{t('insights.dashedNote')}</p>}
      </section>

      <SectionTitle>{t('insights.periodLength')}</SectionTitle>
      <section className="mz-section mz-card">
        <LengthChart points={periodPoints} label={t('insights.periodLengthAria')} />
      </section>

      <SectionTitle>{t('insights.byPhase')}</SectionTitle>
      <section className="mz-section mz-card mz-stack" style={{ gap: 14 }}>
        {phases.length === 0 ? (
          <p className="mz-body-sm mz-muted">{t('insights.byPhaseEmpty')}</p>
        ) : (
          phases.map((p) => {
            const top = p
            return (
              <div key={p.signal} className="mz-stack" style={{ gap: 4 }}>
                <div className="mz-spread">
                  <strong style={{ fontWeight: 500 }}>{symptomLabel(p.signal, t)}</strong>
                  <span className="mz-caption">{t.n('insights.daysLogged', p.occurrences)}</span>
                </div>
                {top && top.rate > 0 && (
                  <p className="mz-body-sm mz-muted">
                    {t('insights.mostIn', {
                      phase: t(`phaseName.${top.phase}` as MessageKey),
                      pct: Math.round(top.rate * 100),
                    })}
                  </p>
                )}
              </div>
            )
          })
        )}
        <p className="mz-caption">{t('insights.associationCaveat')}</p>
      </section>

      <SectionTitle>{t('insights.more')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow icon="clock-counter-clockwise" title={t('you.history')} onClick={() => push({ name: 'history' })} />
        <ListRow icon="chart-line" title={t('you.cycleReport')} onClick={() => push({ name: 'cycle-report' })} />
        <ListRow icon="file-text" title={t('you.doctorReport')} onClick={() => push({ name: 'doctor-report' })} />
        <ListRow icon="book-open" title={t('insights.methodology')} onClick={() => push({ name: 'why' })} />
      </div>
    </div>
  )
}
