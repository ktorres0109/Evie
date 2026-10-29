/**
 * Fertility awareness (spec §5.6). Off by default. Turning it on takes two
 * explanation screens and an explicit "this is not contraception"
 * acknowledgement. The status screen puts the not-contraception block second,
 * at body size, in every state.
 */
import { useState } from 'react'
import { daysBetween } from '../../engine/cycle'
import { useT, type MessageKey } from '../../i18n'
import { dayMonthShort } from '../../i18n/dates'
import { useNav } from '../../state/nav'
import { updatePrefs } from '../../state/prefs'
import type { CycleData } from '../../state/useCycle'
import { Icon } from '../../ui/icons'
import { Banner, FertilityChip, Screen, SectionTitle } from '../../ui/kit'
import { withheldBody, withheldTitle } from './estimateText'

function NotContraception() {
  const t = useT()
  return (
    <div className="mz-section mz-banner mz-banner--disclaimer mz-body" style={{ fontSize: 16, lineHeight: '24px' }}>
      <p className="mz-body">
        <strong style={{ fontWeight: 600 }}>{t('fertility.notContraception.title')}</strong> {t('fertility.notContraception.body')}
      </p>
    </div>
  )
}

export function FertilityScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop, openLog } = useNav()
  const f = data.state.fertility
  const s = data.state

  return (
    <Screen title={t('fertility.title')} onBack={pop}>
      {/* State */}
      <section className="mz-section">
        {f.state === 'suppressed' && s.withheld ? (
          <div className="mz-card mz-stack">
            <div className="mz-title">{withheldTitle(s.withheld, t)}</div>
            <p className="mz-body-sm mz-muted">{t('fertility.suppressed.body')}</p>
            <p className="mz-body-sm mz-muted">{withheldBody(s.withheld, t)}</p>
          </div>
        ) : (
          <div className="mz-stack" style={{ gap: 12 }}>
            <FertilityChip state={f.state} />
            <p className="mz-body">{t(`fertility.today.${f.state}` as MessageKey)}</p>
            <p className="mz-body-sm mz-muted">{t('fertility.estimateCaveat')}</p>
            {f.state === 'unknown' && f.unknownReasons.length > 0 && (
              <ul className="mz-stack" style={{ margin: 0, paddingLeft: 18, gap: 4 }}>
                {f.unknownReasons.map((r) => (
                  <li key={r} className="mz-body-sm mz-muted">{t(`fertility.unknown.${r}` as MessageKey)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Second on screen, body size, every state. */}
      <NotContraception />

      {f.state !== 'suppressed' && (
        <>
          <SectionTitle>{t('fertility.basedOn')}</SectionTitle>
          <div className="mz-section mz-list">
            <div className="mz-list-row" style={{ cursor: 'default' }}>
              <Icon name="thermometer" size={20} className="mz-list-row__icon" />
              <span className="mz-list-row__text">
                <span className="mz-list-row__title">{t.n('fertility.bbtReadings', f.bbtReadingsThisCycle)}</span>
              </span>
              <span className="mz-list-row__end">{f.bbtShiftThisCycle ? t('fertility.bbtShift') : t('fertility.bbtNoShift')}</span>
            </div>
            <div className="mz-list-row" style={{ cursor: 'default' }}>
              <Icon name="flask" size={20} className="mz-list-row__icon" />
              <span className="mz-list-row__text">
                <span className="mz-list-row__title">
                  {f.lastOpk
                    ? t('fertility.opkLast', { result: t(`opk.${f.lastOpk.result}`), date: dayMonthShort(f.lastOpk.date, t.locale) })
                    : t('fertility.opkNone')}
                </span>
              </span>
              <span className="mz-list-row__end">{t('fertility.opkLimit')}</span>
            </div>
            <div className="mz-list-row" style={{ cursor: 'default' }}>
              <Icon name="arrows-clockwise" size={20} className="mz-list-row__icon" />
              <span className="mz-list-row__text">
                <span className="mz-list-row__title">{t('fertility.consistency')}</span>
              </span>
              <span className="mz-list-row__end">{s.spreadDays !== null ? t.n('why.plusMinus', s.spreadDays) : t('fertility.notYet')}</span>
            </div>
            {f.potentialWindow && (
              <div className="mz-list-row" style={{ cursor: 'default' }}>
                <Icon name="calendar-blank" size={20} className="mz-list-row__icon" />
                <span className="mz-list-row__text">
                  <span className="mz-list-row__title">
                    {t('fertility.windowEstimate', {
                      start: dayMonthShort(f.potentialWindow.start, t.locale),
                      end: dayMonthShort(f.potentialWindow.end, t.locale),
                    })}
                  </span>
                  <span className="mz-list-row__sub">{t('fertility.windowEstimateSub', { n: daysBetween(f.potentialWindow.start, f.potentialWindow.end) + 1 })}</span>
                </span>
              </div>
            )}
          </div>
          <p className="mz-caption mz-gutter">{t('fertility.bbtLimit')}</p>
        </>
      )}

      {f.state !== 'suppressed' && (
        <>
          <SectionTitle>{t('fertility.threeStates')}</SectionTitle>
          <div className="mz-section mz-stack" style={{ gap: 8 }}>
            <FertilityChip state="potential" />
            <FertilityChip state="unknown" />
            <FertilityChip state="lower" />
          </div>
        </>
      )}

      <div className="mz-section mz-row" style={{ marginTop: 'var(--space-4)' }}>
        <button type="button" className="mz-btn mz-btn--primary mz-grow" onClick={() => openLog(data.today)}>
          {t('fertility.addBbt')}
        </button>
        <button
          type="button"
          className="mz-btn mz-btn--secondary mz-grow"
          onClick={async () => {
            await updatePrefs({ fertilityMode: false })
            pop()
          }}
        >
          {t('fertility.turnOff')}
        </button>
      </div>
    </Screen>
  )
}

export function FertilitySetupScreen() {
  const t = useT()
  const { pop } = useNav()
  const [step, setStep] = useState(0)
  const [ack, setAck] = useState(false)
  return (
    <Screen title={t('fertility.setup.title')} onBack={() => (step ? setStep(step - 1) : pop())}>
      {step === 0 ? (
        <div className="mz-section mz-stack" style={{ gap: 16 }}>
          <div className="mz-title-lg">{t('fertility.setup.s1.title')}</div>
          <p className="mz-body mz-muted">{t('fertility.setup.s1.body1')}</p>
          <p className="mz-body mz-muted">{t('fertility.setup.s1.body2')}</p>
          <div className="mz-stack" style={{ gap: 8 }}>
            <FertilityChip state="potential" />
            <FertilityChip state="unknown" />
            <FertilityChip state="lower" />
          </div>
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => setStep(1)}>
            {t('common.continue')}
          </button>
        </div>
      ) : (
        <div className="mz-section mz-stack" style={{ gap: 16 }}>
          <div className="mz-title-lg">{t('fertility.setup.s2.title')}</div>
          <Banner tone="disclaimer" icon="warning">
            <span className="mz-body" style={{ display: 'block' }}>
              <strong style={{ fontWeight: 600 }}>{t('fertility.notContraception.title')}</strong> {t('fertility.notContraception.body')}
            </span>
          </Banner>
          <p className="mz-body mz-muted">{t('fertility.setup.s2.body')}</p>
          <label className="mz-card mz-card--sm mz-row" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.currentTarget.checked)}
              style={{ width: 22, height: 22, marginTop: 2, accentColor: 'var(--primary)' }}
            />
            <span className="mz-body-sm">{t('fertility.setup.ack')}</span>
          </label>
          <button
            type="button"
            className="mz-btn mz-btn--primary mz-btn--block"
            disabled={!ack}
            onClick={async () => {
              await updatePrefs({ fertilityMode: true, fertilityAckAt: new Date().toISOString() })
              pop()
            }}
          >
            {t('fertility.setup.turnOn')}
          </button>
          <button type="button" className="mz-btn mz-btn--ghost" onClick={pop}>
            {t('common.notNow')}
          </button>
        </div>
      )}
    </Screen>
  )
}
