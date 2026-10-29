/**
 * Companion (spec §5.9). A plant that grows with total check-ins and never
 * shrinks. After a gap it rests (lower saturation); one check-in wakes it.
 * The return screen offers doing nothing as a real option and never shows a
 * count of days missed.
 */
import { addDays, daysBetween } from '../../engine/cycle'
import { useT, type MessageKey } from '../../i18n'
import { useNav } from '../../state/nav'
import type { CycleData } from '../../state/useCycle'
import { Plant, Screen } from '../../ui/kit'
import { dailyLogHasEntry } from '../../db/schema'

export function CompanionScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop, openLog, setTab } = useNav()
  const c = data.companion
  const weeks = 10
  // Ten weeks of activity as blocks: full (4+ check-ins), part (1–3), empty.
  const blocks = Array.from({ length: weeks }, (_, i) => {
    const end = addDays(data.today, -7 * (weeks - 1 - i))
    const start = addDays(end, -6)
    const n = data.logs.filter((l) => l.date >= start && l.date <= end && dailyLogHasEntry(l)).length
    return n >= 4 ? 'full' : n > 0 ? 'part' : 'empty'
  })
  const firstEntry = data.logs.find(dailyLogHasEntry)?.date
  const cycles = data.state.used.length + data.state.excluded.length

  return (
    <Screen title={c.resting ? undefined : t('companion.title')} onBack={pop}>
      <section className="mz-section mz-stack" style={{ alignItems: 'center', textAlign: 'center', gap: 14, padding: '8px 0 12px' }}>
        <Plant stage={c.stage} resting={c.resting} large />
        {c.resting ? (
          <>
            <div className="mz-title-lg">{t('companion.return.title')}</div>
            <p className="mz-body mz-muted">{t('companion.return.body1')}</p>
            <p className="mz-body mz-muted">{t('companion.return.body2')}</p>
          </>
        ) : (
          <>
            <div className="mz-title">{t(`companion.stageName.${c.stage}` as MessageKey)}</div>
            <p className="mz-body-sm mz-muted">
              {c.nextThreshold ? t('companion.next', { n: c.nextThreshold - c.checkIns }) : t('companion.full')}
            </p>
          </>
        )}
      </section>

      {c.resting && (
        <div className="mz-section mz-stack">
          <button
            type="button"
            className="mz-btn mz-btn--primary mz-btn--block"
            onClick={() => {
              pop()
              openLog(data.today)
            }}
          >
            {t('companion.return.log')}
          </button>
          <button
            type="button"
            className="mz-btn mz-btn--secondary mz-btn--block"
            onClick={() => {
              pop()
              setTab('calendar')
            }}
          >
            {t('companion.return.addDays')}
          </button>
          <button type="button" className="mz-btn mz-btn--ghost" onClick={pop} style={{ color: 'var(--text-2)' }}>
            {t('companion.return.looking')}
          </button>
        </div>
      )}

      <section className="mz-section mz-card mz-stack" style={{ gap: 10 }}>
        <div className="mz-label">{t('companion.since')}</div>
        <div className="mz-body">
          {t.n('companion.cycles', cycles)} · {t.n('companion.checkIns', c.checkIns)}
        </div>
        <div className="mz-history" role="img" aria-label={t('companion.historyAria')}>
          {blocks.map((b, i) => (
            <span key={i} className={`mz-history__block${b === 'full' ? ' is-full' : b === 'part' ? ' is-part' : ''}`} />
          ))}
        </div>
        <p className="mz-caption">{t('companion.gapNote')}</p>
        {firstEntry && daysBetween(firstEntry, data.today) < 70 && <p className="mz-caption">{t('companion.newNote')}</p>}
      </section>

      <div className="mz-section mz-card mz-card--raised">
        <p className="mz-body-sm mz-muted">{t('companion.never')}</p>
      </div>
    </Screen>
  )
}
