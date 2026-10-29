/**
 * Cycle history: every cycle with its length and whether it fed the estimate.
 * Nothing is aggregated away; left-out cycles stay visible here and in trends.
 */
import { useT } from '../../i18n'
import { dateRange } from '../../i18n/dates'
import { useNav } from '../../state/nav'
import type { CycleData } from '../../state/useCycle'
import { Icon } from '../../ui/icons'
import { Screen } from '../../ui/kit'
import { exclusionText } from './estimateText'

export function HistoryScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop } = useNav()
  const s = data.state
  const rows = [
    ...s.used.map((c) => ({ ...c, reason: null as null | string })),
    ...s.excluded.map((c) => ({ ...c, reason: exclusionText(c.reason, t) })),
  ].sort((a, b) => b.start.localeCompare(a.start))

  return (
    <Screen title={t('you.history')} onBack={pop}>
      {s.lastPeriodStart && (
        <div className="mz-section mz-card mz-card--sm">
          <div className="mz-caption">{t('history.current')}</div>
          <div className="mz-body">{s.cycleDay ? t('today.hero.day', { n: s.cycleDay }) : '—'}</div>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="mz-body-sm mz-muted mz-gutter">{t('history.empty')}</p>
      ) : (
        <div className="mz-section mz-list">
          {rows.map((r) => (
            <div key={r.start} className="mz-list-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <Icon
                name={r.reason ? 'minus' : 'check-circle:fill'}
                size={20}
                style={{ color: r.reason ? 'var(--text-3)' : 'var(--care)', marginTop: 2 }}
              />
              <span className="mz-list-row__text">
                <span className="mz-list-row__title">{dateRange(r.start, r.end, t.locale, true)}</span>
                <span className="mz-list-row__sub">{r.reason ?? t('history.used')}</span>
              </span>
              <span className="mz-list-row__end" style={{ color: 'var(--text)' }}>{t.n('common.days', r.length)}</span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}
