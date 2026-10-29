/**
 * Owner — You (spec §03). Grouped by what a person is looking for:
 * modes, your body's context, how the app looks and speaks, who can get in
 * and who can see, and your data.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, SK } from '../../db/schema'
import { activeRegimenOn } from '../../db/regimen'
import { useLocale, useT, type LocalePreference } from '../../i18n'
import { useNav } from '../../state/nav'
import { updatePrefs, type Prefs } from '../../state/prefs'
import type { CycleData } from '../../state/useCycle'
import { ListRow, SectionTitle, SwitchRow } from '../../ui/kit'
import { methodName } from './estimateText'
import { readPartner } from '../../partner/store'

export function YouTab({ data, prefs }: { data: CycleData; prefs: Prefs }) {
  const t = useT()
  const { push } = useNav()
  const preference = useLocale((s) => s.preference)
  const setPreference = useLocale((s) => s.setPreference)
  const hasPin = useLiveQuery(async () => Boolean(await getSetting(SK.pinHash)), [])
  const partner = useLiveQuery(readPartner, [])
  const active = activeRegimenOn(data.regimens, data.today)
  const lifeCount = data.lifeEvents.filter((e) => e.kind !== 'pregnancy' && e.kind !== 'pregnancy-ended').length
  const transfers = useLiveQuery(() => db.transfers.count(), [])

  const methodSub = active
    ? methodName(active.config?.kind === 'iud' ? (active.config.hormonal ? 'hormonal-iud' : 'copper-iud') : active.method, t)
    : t('you.method.none')

  return (
    <div className="mz-page">
      <header className="mz-appbar">
        <h1 className="mz-h1">{t('nav.you')}</h1>
      </header>

      <SectionTitle>{t('you.section.modes')}</SectionTitle>
      <div className="mz-section mz-list">
        <SwitchRow
          title={t('you.fertilityMode')}
          sub={prefs.fertilityMode ? t('you.fertilityMode.on') : t('you.fertilityMode.off')}
          checked={prefs.fertilityMode}
          onChange={(next) => (next ? push({ name: 'fertility-setup' }) : void updatePrefs({ fertilityMode: false }))}
        />
        {prefs.fertilityMode && (
          <SwitchRow
            title={t('you.calendarOverlay')}
            sub={t('you.calendarOverlay.sub')}
            checked={prefs.calendarFertilityOverlay}
            onChange={(next) => void updatePrefs({ calendarFertilityOverlay: next })}
          />
        )}
      </div>

      <SectionTitle>{t('you.section.body')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow icon="pill" title={t('you.method')} sub={methodSub} onClick={() => push({ name: 'method' })} />
        <ListRow icon="baby" title={t('you.pregnancy')} sub={data.state.withheld?.code === 'pregnancy' ? t('you.pregnancy.on') : t('you.pregnancy.sub')} onClick={() => push({ name: 'pregnancy' })} />
        <ListRow
          icon="list-checks"
          title={t('you.life')}
          sub={lifeCount ? t.n('you.life.count', lifeCount) : t('you.life.sub')}
          onClick={() => push({ name: 'life' })}
        />
        <ListRow icon="clock-counter-clockwise" title={t('you.history')} sub={t('you.history.sub')} onClick={() => push({ name: 'history' })} />
      </div>

      <SectionTitle>{t('you.section.sharing')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow
          icon="hand-heart"
          title={t('you.partner')}
          sub={
            partner?.status === 'paired'
              ? partner.paused
                ? t('you.partner.paused', { name: partner.partnerName })
                : t('you.partner.paired', { name: partner.partnerName })
              : t('you.partner.none')
          }
          onClick={() => push({ name: 'partner' })}
        />
      </div>

      <SectionTitle>{t('you.section.app')}</SectionTitle>
      <div className="mz-section mz-list">
        <label className="mz-list-row" style={{ cursor: 'default' }}>
          <span className="mz-list-row__text">
            <span className="mz-list-row__title">{t('settings.language')}</span>
          </span>
          <select
            className="mz-select"
            style={{ width: 'auto', minHeight: 40, border: 0, background: 'transparent', textAlign: 'right' }}
            value={preference}
            onChange={(e) => setPreference(e.currentTarget.value as LocalePreference)}
            aria-label={t('settings.language')}
          >
            <option value="system">{t('settings.language.system')}</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
        <ListRow icon="circle-half" title={t('you.appearance')} sub={t(`appearance.${prefs.theme}`)} onClick={() => push({ name: 'appearance' })} />
        <ListRow icon="bell" title={t('you.notifications')} sub={t(`tone.${prefs.notificationTone}`)} onClick={() => push({ name: 'notifications' })} />
      </div>

      <SectionTitle>{t('you.section.privacy')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow icon="lock-simple" title={t('you.lock')} sub={hasPin ? t('you.lock.on') : t('you.lock.off')} onClick={() => push({ name: 'lock' })} />
        <ListRow
          icon="device-mobile"
          title={t('you.privacy')}
          sub={transfers ? t.n('you.privacy.transfers', transfers) : t('you.privacy.sub')}
          onClick={() => push({ name: 'privacy' })}
        />
      </div>

      <SectionTitle>{t('you.section.reports')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow icon="file-text" title={t('you.doctorReport')} sub={t('you.doctorReport.sub')} onClick={() => push({ name: 'doctor-report' })} />
        <ListRow icon="chart-line" title={t('you.cycleReport')} onClick={() => push({ name: 'cycle-report' })} />
        <ListRow icon="book-open" title={t('you.articles')} onClick={() => push({ name: 'articles' })} />
      </div>

      <SectionTitle>{t('you.section.about')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow icon="info" title={t('you.about')} sub={t('you.about.sub')} onClick={() => push({ name: 'about' })} />
        <ListRow icon="gear-six" title={t('you.advanced')} sub={t('you.advanced.sub')} onClick={() => push({ name: 'legacy-settings' })} />
      </div>
    </div>
  )
}
