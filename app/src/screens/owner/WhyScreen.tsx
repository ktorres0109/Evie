/**
 * Why this estimate? (spec §5.5) — the product's conscience. Answer first,
 * inputs itemised, exclusions visible with reasons, method in one sentence,
 * sufficiency without a chore. Also the suppressed / insufficient / irregular
 * variants.
 */
import { useT, type MessageKey } from '../../i18n'
import { betweenDates, dayMonthShort } from '../../i18n/dates'
import { useNav } from '../../state/nav'
import type { CycleData } from '../../state/useCycle'
import { Icon } from '../../ui/icons'
import { ConfidenceMeter, Screen, SectionTitle } from '../../ui/kit'
import { exclusionText, rangeText, widenText, withheldBody, withheldTitle } from './estimateText'

export function WhyScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop, push } = useNav()
  const s = data.state
  const range = rangeText(s, t)

  return (
    <Screen title={t('why.title')} onBack={pop}>
      {/* Answer first */}
      <section className="mz-gutter" style={{ padding: '8px 24px 20px' }}>
        {s.status === 'withheld' && s.withheld ? (
          <>
            <div className="mz-title-lg" style={{ marginBottom: 8 }}>{withheldTitle(s.withheld, t)}</div>
            <p className="mz-body mz-muted">{withheldBody(s.withheld, t)}</p>
            {s.withdrawalBleed && (
              <p className="mz-body-sm mz-muted" style={{ marginTop: 12 }}>
                {t(`why.withdrawal.${s.withdrawalBleed.method}` as MessageKey)}
              </p>
            )}
          </>
        ) : s.status === 'ok' && range ? (
          <>
            <div className="mz-caption" style={{ marginBottom: 6 }}>{t('why.weThink')}</div>
            <div className="mz-display-md" style={{ fontSize: 32, lineHeight: '38px', marginBottom: 14 }}>
              {s.displayInWeeks || !s.window ? range : t('why.between', { range: betweenDates(s.window.start, s.window.end, t.locale) })}
            </div>
            <ConfidenceMeter level={s.confidence} />
            <div className="mz-body-sm mz-muted" style={{ marginTop: 8 }}>
              {t('why.confidenceOf', { word: t(`confidence.${s.confidence}` as MessageKey), n: t(`number.${s.confidence}` as MessageKey) })}
            </div>
          </>
        ) : (
          <>
            <div className="mz-title-lg" style={{ marginBottom: 8 }}>
              {s.status === 'no-history' ? t('why.none.title') : s.status === 'stale' ? t('why.stale.title') : t('why.insufficient.title')}
            </div>
            <p className="mz-body mz-muted">
              {s.status === 'no-history' ? t('why.none.body') : s.status === 'stale' ? t('why.stale.body') : t('why.insufficient.body')}
            </p>
            {s.status === 'insufficient' && range && (
              <p className="mz-body-sm mz-muted" style={{ marginTop: 12 }}>{t('why.rough', { range })}</p>
            )}
          </>
        )}
      </section>

      {/* What we used */}
      {s.used.length > 0 && (
        <>
          <SectionTitle>{t('why.used')}</SectionTitle>
          <div className="mz-section mz-list">
            {s.used.map((c) => (
              <div key={c.start} className="mz-list-row" style={{ cursor: 'default' }}>
                <Icon name="check-circle:fill" size={20} style={{ color: 'var(--care)' }} />
                <span className="mz-list-row__text">
                  <span className="mz-list-row__title">{t('why.cycleEnding', { date: dayMonthShort(c.end, t.locale) })}</span>
                </span>
                <span className="mz-list-row__end" style={{ color: 'var(--text)' }}>{t.n('common.days', c.length)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* What we left out — visible rows, never a footnote */}
      {s.excluded.length > 0 && (
        <>
          <SectionTitle>{t('why.leftOut')}</SectionTitle>
          <div className="mz-section mz-list">
            {s.excluded.map((c) => (
              <div key={c.start} className="mz-list-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <Icon name="minus" size={20} className="mz-faint" style={{ marginTop: 2 }} />
                <span className="mz-list-row__text">
                  <span className="mz-list-row__title">
                    {t('why.cycleEnding', { date: dayMonthShort(c.end, t.locale) })}{' '}
                    <span className="mz-faint">· {t.n('common.days', c.length)}</span>
                  </span>
                  <span className="mz-list-row__sub">
                    {exclusionText(c.reason, t)} {t('why.stillInHistory')}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Widening context */}
      {s.widenedBy.length > 0 && s.status !== 'withheld' && (
        <>
          <SectionTitle>{t('why.wider')}</SectionTitle>
          <div className="mz-section mz-card mz-stack" style={{ gap: 10 }}>
            {s.widenedBy.map((r) => (
              <p key={r} className="mz-body-sm">{widenText(r, t)}</p>
            ))}
          </div>
        </>
      )}

      {/* How */}
      <SectionTitle>{t('why.how')}</SectionTitle>
      <div className="mz-section mz-card">
        <p className="mz-body-sm" style={{ marginBottom: 12 }}>
          {s.used.length >= 2 ? t.n('why.method', s.used.length) : t('why.methodFew')}
        </p>
        {s.medianLength !== null && (
          <div className="mz-kv">
            <span className="mz-muted">{t('why.median')}</span>
            <span>{t.n('common.days', Math.round(s.medianLength))}</span>
          </div>
        )}
        {s.spreadDays !== null && (
          <div className="mz-kv">
            <span className="mz-muted">{t('why.spread')}</span>
            <span>{t.n('why.plusMinus', s.spreadDays)}</span>
          </div>
        )}
      </div>

      {/* Sufficiency, then the ceiling */}
      {s.status !== 'withheld' && (
        <div className="mz-section mz-card mz-card--raised">
          <p className="mz-body-sm mz-muted">
            {s.used.length < 6 ? t('why.moreCycles') : t('why.enoughCycles')} {t('why.ceiling')}
          </p>
        </div>
      )}

      <div className="mz-section mz-stack" style={{ marginTop: 'var(--space-4)' }}>
        <button type="button" className="mz-btn mz-btn--secondary mz-btn--block" onClick={() => push({ name: 'history' })}>
          {t('why.history')}
        </button>
        <button type="button" className="mz-btn mz-btn--ghost" onClick={() => push({ name: 'life' })}>
          {t('why.addContext')}
        </button>
      </div>
    </Screen>
  )
}
