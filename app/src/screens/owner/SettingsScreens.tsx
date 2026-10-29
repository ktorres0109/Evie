/**
 * Smaller You screens: appearance, notifications (tone first, system prompt
 * after), app lock, and About (source offer, licences, credits).
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { hashPin, newSalt } from '../../crypto/vault'
import { getSetting, removeSetting, setSetting, SK } from '../../db/schema'
import { activeRegimenOn } from '../../db/regimen'
import { useT, type MessageKey } from '../../i18n'
import { authenticateWithBiometrics, getBiometricStatus } from '../../native/biometrics'
import { isNative } from '../../native/runtime'
import { requestReminderPermission, scheduleAllReminders } from '../../native/schedule'
import { useNav } from '../../state/nav'
import { updatePrefs, type NotificationTone, type Prefs, type ThemePref } from '../../state/prefs'
import { useApp } from '../../state/appStore'
import type { CycleData } from '../../state/useCycle'
import { Icon } from '../../ui/icons'
import { Banner, ListRow, Screen, SectionTitle, Sheet, SwitchRow } from '../../ui/kit'

function RadioList<T extends string>({ value, options, onChange }: { value: T; options: { id: T; title: string; sub?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mz-list" role="radiogroup">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="mz-list-row" onClick={() => onChange(o.id)}>
          <span className="mz-list-row__text">
            <span className="mz-list-row__title">{o.title}</span>
            {o.sub && <span className="mz-list-row__sub">{o.sub}</span>}
          </span>
          <span className="mz-list-row__end">{value === o.id && <Icon name="check" size={20} style={{ color: 'var(--primary-hi)' }} />}</span>
        </button>
      ))}
    </div>
  )
}

export function AppearanceScreen({ prefs }: { prefs: Prefs }) {
  const t = useT()
  const { pop } = useNav()
  return (
    <Screen title={t('you.appearance')} onBack={pop}>
      <div className="mz-section">
        <RadioList<ThemePref>
          value={prefs.theme}
          onChange={(theme) => void updatePrefs({ theme })}
          options={(['night', 'day', 'system'] as const).map((id) => ({ id, title: t(`appearance.${id}`), sub: t(`appearance.${id}.sub` as MessageKey) }))}
        />
      </div>
    </Screen>
  )
}

export function NotificationsScreen({ prefs, data }: { prefs: Prefs; data: CycleData }) {
  const t = useT()
  const { pop } = useNav()
  const [denied, setDenied] = useState(false)
  const hasMethod = Boolean(activeRegimenOn(data.regimens, data.today)?.config)

  async function change(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch }
    const wantsAny = next.notificationTone !== 'off' && (next.methodReminderTime || next.checkInReminderTime || next.windowReminder)
    if (wantsAny && isNative) {
      const ok = await requestReminderPermission()
      setDenied(!ok)
    }
    await updatePrefs(patch)
    void scheduleAllReminders()
  }

  return (
    <Screen title={t('you.notifications')} onBack={pop}>
      <p className="mz-body-sm mz-muted mz-gutter" style={{ marginBottom: 12 }}>{t('notify.intro')}</p>
      <SectionTitle>{t('notify.tone')}</SectionTitle>
      <div className="mz-section">
        <RadioList<NotificationTone>
          value={prefs.notificationTone}
          onChange={(tone) => void change({ notificationTone: tone })}
          options={(['warm', 'neutral', 'minimal', 'off'] as const).map((id) => ({ id, title: t(`tone.${id}`), sub: t(`tone.${id}.sub` as MessageKey) }))}
        />
      </div>

      {prefs.notificationTone !== 'off' && (
        <>
          <SectionTitle>{t('notify.which')}</SectionTitle>
          <div className="mz-section mz-list">
            <TimeRow
              title={t('notify.method')}
              sub={hasMethod ? t('notify.method.sub') : t('notify.method.none')}
              value={prefs.methodReminderTime}
              disabled={!hasMethod}
              onChange={(v) => void change({ methodReminderTime: v })}
            />
            {prefs.notificationTone !== 'minimal' && (
              <TimeRow title={t('notify.checkIn')} sub={t('notify.checkIn.sub')} value={prefs.checkInReminderTime} onChange={(v) => void change({ checkInReminderTime: v })} />
            )}
            <SwitchRow title={t('notify.window')} sub={t('notify.window.sub')} checked={prefs.windowReminder} onChange={(v) => void change({ windowReminder: v })} />
          </div>
        </>
      )}
      {denied && (
        <div className="mz-section">
          <Banner tone="info" icon="info">{t('notify.denied')}</Banner>
        </div>
      )}
      {!isNative && <p className="mz-caption mz-gutter">{t('notify.webOnly')}</p>}
      <div className="mz-section mz-card mz-card--raised" style={{ marginTop: 12 }}>
        <div className="mz-label" style={{ marginBottom: 6 }}>{t('notify.preview')}</div>
        <p className="mz-body-sm"><strong style={{ fontWeight: 600 }}>{t('notify.title')}</strong> · {t(prefs.notificationTone === 'warm' ? 'notify.checkIn.warm' : 'notify.checkIn.neutral')}</p>
        <p className="mz-caption" style={{ marginTop: 6 }}>{t('notify.never')}</p>
      </div>
    </Screen>
  )
}

function TimeRow({ title, sub, value, onChange, disabled }: { title: string; sub: string; value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  return (
    <div className="mz-list-row" style={{ cursor: 'default' }}>
      <span className="mz-list-row__text">
        <span className="mz-list-row__title">{title}</span>
        <span className="mz-list-row__sub">{sub}</span>
      </span>
      <input
        type="time"
        className="mz-input"
        style={{ width: 120, minHeight: 44 }}
        value={value ?? ''}
        disabled={disabled}
        aria-label={title}
        onChange={(e) => onChange(e.currentTarget.value || null)}
      />
    </div>
  )
}

export function LockScreen({ locked }: { locked: boolean }) {
  const t = useT()
  const { pop } = useNav()
  const state = useLiveQuery(async () => ({ pin: Boolean(await getSetting(SK.pinHash)), bio: (await getSetting(SK.biometricLock)) === '1' }), [])
  const [setting, setSetting_] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  void locked

  async function toggleBio() {
    if (state?.bio) {
      await removeSetting(SK.biometricLock)
      return
    }
    const status = await getBiometricStatus()
    if (!status.available || !status.enrolled) {
      setMessage(t('lock.noBio'))
      return
    }
    const result = await authenticateWithBiometrics(t('lock.bioReason'))
    if (result.authenticated) await setSetting(SK.biometricLock, '1')
  }

  return (
    <Screen title={t('you.lock')} onBack={pop}>
      <p className="mz-body-sm mz-muted mz-gutter" style={{ marginBottom: 12 }}>{t('lock.intro')}</p>
      <div className="mz-section mz-list">
        {state?.pin ? (
          <>
            <SwitchRow title={t('lock.bio')} sub={t('lock.bio.sub')} checked={state.bio} onChange={() => void toggleBio()} disabled={!isNative} />
            <ListRow title={t('lock.lockNow')} onClick={() => useApp.getState().setLocked(true)} />
            <ListRow title={t('lock.changePin')} onClick={() => setSetting_(true)} />
            <ListRow
              title={t('lock.remove')}
              danger
              onClick={async () => {
                await removeSetting(SK.pinHash)
                await removeSetting(SK.pinSalt)
                await removeSetting(SK.biometricLock)
              }}
            />
          </>
        ) : (
          <ListRow icon="lock-simple" title={t('lock.setPin')} sub={t('lock.setPin.sub')} onClick={() => setSetting_(true)} />
        )}
      </div>
      {message && (
        <div className="mz-section">
          <Banner tone="info">{message}</Banner>
        </div>
      )}
      <div className="mz-section mz-card mz-card--raised">
        <p className="mz-body-sm mz-muted">{t('privacy.honesty')}</p>
      </div>
      {setting && <PinSheet onClose={() => setSetting_(false)} />}
    </Screen>
  )
}

function PinSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const value = step === 1 ? first : second
  const mismatch = step === 2 && second.length === 4 && second !== first
  return (
    <Sheet
      title={step === 1 ? t('lock.choosePin') : t('lock.confirmPin')}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="mz-btn mz-btn--primary mz-btn--block"
          disabled={value.length !== 4 || mismatch}
          onClick={async () => {
            if (step === 1) {
              setStep(2)
              return
            }
            const salt = newSalt()
            await setSetting(SK.pinSalt, salt)
            await setSetting(SK.pinHash, await hashPin(first, salt))
            onClose()
          }}
        >
          {step === 1 ? t('common.continue') : t('common.save')}
        </button>
      }
    >
      <input
        className="mz-input"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="off"
        aria-label={step === 1 ? t('lock.choosePin') : t('lock.confirmPin')}
        value={value}
        data-autofocus
        onChange={(e) => {
          const digits = e.currentTarget.value.replace(/\D/g, '').slice(0, 4)
          if (step === 1) setFirst(digits)
          else setSecond(digits)
        }}
        style={{ fontSize: 28, letterSpacing: '0.5em', textAlign: 'center' }}
      />
      {mismatch && <p className="mz-field__error" style={{ marginTop: 8 }}>{t('lock.mismatch')}</p>}
      <p className="mz-caption" style={{ marginTop: 12 }}>{t('lock.pinNote')}</p>
    </Sheet>
  )
}

export const SOURCE_URL = 'https://github.com/ktorres0109/Evie'

export function AboutScreen() {
  const t = useT()
  const { pop } = useNav()
  return (
    <Screen title={t('you.about')} onBack={pop}>
      <section className="mz-section mz-card mz-stack" style={{ gap: 10 }}>
        <div className="mz-brand">
          <span className="mz-brand__dot" aria-hidden="true" />
          <span className="mz-brand__name">Meztli</span>
        </div>
        <p className="mz-body-sm mz-muted">{t('about.meaning')}</p>
        <p className="mz-body-sm mz-muted">{t('disclaimer.short')}</p>
      </section>
      <SectionTitle>{t('about.source')}</SectionTitle>
      <div className="mz-section mz-list">
        <a className="mz-list-row" href={SOURCE_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <Icon name="github-logo" size={22} className="mz-list-row__icon" />
          <span className="mz-list-row__text">
            <span className="mz-list-row__title">{t('about.sourceRow')}</span>
            <span className="mz-list-row__sub">{t('about.license')}</span>
          </span>
        </a>
      </div>
      <SectionTitle>{t('about.credits')}</SectionTitle>
      <div className="mz-section mz-card mz-stack" style={{ gap: 6 }}>
        <p className="mz-body-sm mz-muted">{t('about.credit.lunara')}</p>
        <p className="mz-body-sm mz-muted">{t('about.credit.font')}</p>
        <p className="mz-body-sm mz-muted">{t('about.credit.icons')}</p>
        <p className="mz-body-sm mz-muted">{t('about.credit.mensinator')}</p>
      </div>
    </Screen>
  )
}
