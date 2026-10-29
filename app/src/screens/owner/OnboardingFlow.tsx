/**
 * Onboarding (spec §5.1): a role choice, then six steps, each one title, one
 * choice and one button. Nothing to read before you can act. Partner sharing
 * never appears here.
 *
 *   0 Who is this phone for?   (owner / partner)
 *   1 Privacy + age            (Flo's rule: 13+, 16+ in the EU, UK, Canada)
 *   2 Purpose                  (pick any, or none)
 *   3 Last period              (a date, or "Not sure")
 *   4 Birth control            (skippable)
 *   5 Reminders                (tone first; the system prompt comes after)
 *   6 App lock                 (offered, not required)
 */
import { useState } from 'react'
import { hashPin, newSalt } from '../../crypto/vault'
import { db, normalizeHealthProfile, putHealthProfile, setSetting, SK } from '../../db/schema'
import { regimenId } from '../../db/regimen'
import { addDays } from '../../engine/cycle'
import { useLocale, useT, type LocalePreference, type MessageKey } from '../../i18n'
import { localToday } from '../../lib/dates'
import { requestReminderPermission } from '../../native/schedule'
import { updatePrefs, type NotificationTone } from '../../state/prefs'
import { Icon, type IconName } from '../../ui/icons'

type Purpose = 'cycle' | 'symptoms' | 'pregnant' | 'fertility'
type MethodPick = 'none' | 'pill' | 'patch-ring' | 'iud-implant-shot' | 'condoms' | 'other' | 'skip'

const PURPOSES: { id: Purpose; icon: IconName; label: MessageKey }[] = [
  { id: 'cycle', icon: 'moon', label: 'ob.purpose.cycle' },
  { id: 'symptoms', icon: 'note-pencil', label: 'ob.purpose.symptoms' },
  { id: 'pregnant', icon: 'heart', label: 'ob.purpose.pregnant' },
  { id: 'fertility', icon: 'thermometer', label: 'ob.purpose.fertility' },
]

function Frame({
  step,
  title,
  helper,
  children,
  action,
  onBack,
}: {
  step: number
  title: string
  helper?: string
  children: React.ReactNode
  action: React.ReactNode
  onBack?: () => void
}) {
  const t = useT()
  return (
    <div className="mz-app">
      <div className="mz-main">
        <div className="mz-page mz-page--flush-bottom" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
          <header className="mz-appbar mz-appbar--back">
            {onBack ? (
              <button type="button" className="mz-icon-btn" onClick={onBack} aria-label={t('common.back')}>
                <Icon name="caret-left" size={22} />
              </button>
            ) : (
              <span style={{ width: 48 }} />
            )}
            {step > 0 && (
              <div className="mz-meter" style={{ width: 120 }} aria-label={t('ob.progress', { n: step, total: 6 })}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <span key={i} className={`mz-meter__seg${i <= step ? ' is-on' : ''}`} style={{ animation: 'none' }} />
                ))}
              </div>
            )}
            <span style={{ width: 48 }} />
          </header>
          <div className="mz-hero" style={{ paddingTop: 12 }}>
            <h1 className="mz-title-lg" style={{ margin: 0 }}>{title}</h1>
            {helper && <p className="mz-body mz-muted" style={{ marginTop: 6 }}>{helper}</p>}
          </div>
          <div className="mz-section mz-grow">{children}</div>
          <div className="mz-section">{action}</div>
        </div>
      </div>
    </div>
  )
}

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const t = useT()
  const today = localToday()
  const preference = useLocale((s) => s.preference)
  const setPreference = useLocale((s) => s.setPreference)
  const [step, setStep] = useState(0)
  const [age, setAge] = useState(false)
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [lastPeriod, setLastPeriod] = useState<string>('')
  const [notSure, setNotSure] = useState(false)
  const [method, setMethod] = useState<MethodPick | null>(null)
  const [tone, setTone] = useState<NotificationTone>('neutral')
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)

  const next = () => setStep((s) => s + 1)
  const back = () => setStep((s) => Math.max(0, s - 1))

  async function finish(withPin: boolean) {
    setSaving(true)
    const now = new Date().toISOString()
    const contraception =
      method === 'pill' || method === 'patch-ring'
        ? 'combined-pill-patch-ring'
        : method === 'iud-implant-shot'
          ? 'other'
          : method === 'condoms'
            ? 'barrier'
            : method === 'none'
              ? 'none'
              : method === 'other'
                ? 'other'
                : 'unknown'
    await putHealthProfile(
      normalizeHealthProfile({
        goals: ['cycle'],
        primaryGoal: 'cycle',
        cycle: {
          regularity: 'unsure',
          lastPeriodStart: lastPeriod || undefined,
          dateConfidence: lastPeriod ? 'approximate' : 'unknown',
          abnormalities: [],
          baselineSymptoms: [],
          hormonalSignals: [],
        },
        reproductive: { contraception },
        privacy: {
          ageBand: 'unknown',
          minimumAgeConfirmed: age,
          localOnly: true,
          onboardingVersion: 2,
          consentLedger: [{ purpose: 'local-health-storage', state: 'granted', version: 1, decidedAt: now }],
        },
      }),
    )
    if (lastPeriod) {
      const existing = await db.dailyLogs.get(lastPeriod)
      if (!existing?.flow) await db.dailyLogs.put({ ...(existing ?? { date: lastPeriod }), date: lastPeriod, flow: 'medium', periodStart: true })
    }
    // Methods with a schedule get set up properly in You → Birth control; record what we know now.
    if (method === 'pill' || method === 'patch-ring') {
      await db.regimenRecords.put({
        id: regimenId('combined-pill-patch-ring', today),
        method: 'combined-pill-patch-ring',
        startDate: today,
        createdAt: now,
        updatedAt: now,
      })
    }
    await updatePrefs({
      role: 'owner',
      notificationTone: tone,
      checkInReminderTime: tone === 'off' || tone === 'minimal' ? null : '20:00',
      windowReminder: tone !== 'off',
      fertilityMode: false,
    })
    if (withPin && pin.length === 4) {
      const salt = newSalt()
      await setSetting(SK.pinSalt, salt)
      await setSetting(SK.pinHash, await hashPin(pin, salt))
    }
    await setSetting('onboarding.purposes', JSON.stringify(purposes))
    await setSetting(SK.onboarded, '1')
    onDone()
  }

  // ---------- 0 · Who is this phone for? ----------
  if (step === 0) {
    return (
      <Frame
        step={0}
        title={t('ob.role.title')}
        helper={t('ob.role.helper')}
        action={
          <label className="mz-row" style={{ justifyContent: 'center' }}>
            <span className="mz-caption">{t('settings.language')}</span>
            <select className="mz-select" style={{ width: 'auto', minHeight: 40 }} value={preference} onChange={(e) => setPreference(e.currentTarget.value as LocalePreference)}>
              <option value="system">{t('settings.language.system')}</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>
        }
      >
        <div className="mz-stack">
          <button type="button" className="mz-card mz-card--button mz-row" style={{ minHeight: 96 }} onClick={next}>
            <Icon name="moon" size={28} style={{ color: 'var(--primary-hi)' }} />
            <span className="mz-grow">
              <span className="mz-title" style={{ display: 'block' }}>{t('ob.role.owner')}</span>
              <span className="mz-body-sm mz-muted">{t('ob.role.owner.sub')}</span>
            </span>
          </button>
          <button
            type="button"
            className="mz-card mz-card--button mz-row"
            style={{ minHeight: 96 }}
            onClick={async () => {
              await updatePrefs({ role: 'partner' })
              await setSetting(SK.onboarded, '1')
              onDone()
            }}
          >
            <Icon name="hand-heart" size={28} style={{ color: 'var(--care)' }} />
            <span className="mz-grow">
              <span className="mz-title" style={{ display: 'block' }}>{t('ob.role.partner')}</span>
              <span className="mz-body-sm mz-muted">{t('ob.role.partner.sub')}</span>
            </span>
          </button>
        </div>
      </Frame>
    )
  }

  // ---------- 1 · Privacy ----------
  if (step === 1) {
    return (
      <Frame
        step={1}
        title={t('ob.privacy.title')}
        helper={t('ob.privacy.helper')}
        onBack={back}
        action={
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" disabled={!age} onClick={next}>
            {t('common.continue')}
          </button>
        }
      >
        <div className="mz-stack" style={{ gap: 12 }}>
          {(['local', 'noAccount', 'yourChoice'] as const).map((k) => (
            <div key={k} className="mz-row" style={{ alignItems: 'flex-start' }}>
              <Icon name={k === 'local' ? 'device-mobile' : k === 'noAccount' ? 'cloud-slash' : 'hand-heart'} size={22} style={{ color: 'var(--care)', flex: 'none' }} />
              <p className="mz-body-sm mz-muted">{t(`ob.privacy.${k}`)}</p>
            </div>
          ))}
          <label className="mz-card mz-card--sm mz-row" style={{ cursor: 'pointer', marginTop: 8 }}>
            <input type="checkbox" checked={age} onChange={(e) => setAge(e.currentTarget.checked)} style={{ width: 22, height: 22, accentColor: 'var(--primary)' }} />
            <span className="mz-body-sm">{t('ob.privacy.age')}</span>
          </label>
          <p className="mz-caption">{t('ob.privacy.notMedical')}</p>
        </div>
      </Frame>
    )
  }

  // ---------- 2 · Purpose ----------
  if (step === 2) {
    return (
      <Frame
        step={2}
        title={t('ob.purpose.title')}
        helper={t('ob.purpose.helper')}
        onBack={back}
        action={
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={next}>
            {t('common.continue')}
          </button>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {PURPOSES.map((p) => {
            const on = purposes.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                className="mz-card mz-card--button mz-stack"
                style={{
                  minHeight: 118,
                  justifyContent: 'space-between',
                  boxShadow: on ? 'inset 0 0 0 1.5px var(--primary)' : undefined,
                  background: on ? 'var(--primary-tint)' : undefined,
                }}
                onClick={() => setPurposes(on ? purposes.filter((x) => x !== p.id) : [...purposes, p.id])}
              >
                <Icon name={on ? 'check' : p.icon} size={24} style={{ color: on ? 'var(--primary-hi)' : 'var(--text-2)' }} />
                <span style={{ fontSize: 15 }}>{t(p.label)}</span>
              </button>
            )
          })}
        </div>
        <p className="mz-caption" style={{ marginTop: 16, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name="lock-simple" size={14} /> {t('ob.staysHere')}
        </p>
      </Frame>
    )
  }

  // ---------- 3 · Last period ----------
  if (step === 3) {
    return (
      <Frame
        step={3}
        title={t('ob.last.title')}
        helper={t('ob.last.helper')}
        onBack={back}
        action={
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" disabled={!lastPeriod && !notSure} onClick={next}>
            {t('common.continue')}
          </button>
        }
      >
        <div className="mz-stack" style={{ gap: 12 }}>
          <input
            className="mz-input"
            type="date"
            value={lastPeriod}
            min={addDays(today, -120)}
            max={today}
            aria-label={t('ob.last.title')}
            onChange={(e) => {
              setLastPeriod(e.currentTarget.value)
              setNotSure(false)
            }}
          />
          <button
            type="button"
            className="mz-chip"
            aria-pressed={notSure}
            onClick={() => {
              setNotSure(!notSure)
              setLastPeriod('')
            }}
          >
            {notSure && <span aria-hidden="true">✓</span>}
            {t('ob.last.notSure')}
          </button>
          <p className="mz-caption">{t('ob.last.note')}</p>
        </div>
      </Frame>
    )
  }

  // ---------- 4 · Birth control ----------
  if (step === 4) {
    const opts: MethodPick[] = ['none', 'pill', 'patch-ring', 'iud-implant-shot', 'condoms', 'other']
    return (
      <Frame
        step={4}
        title={t('ob.method.title')}
        helper={t('ob.method.helper')}
        onBack={back}
        action={
          <div className="mz-stack" style={{ gap: 8 }}>
            <button type="button" className="mz-btn mz-btn--primary mz-btn--block" disabled={!method} onClick={next}>
              {t('common.continue')}
            </button>
            <button type="button" className="mz-btn mz-btn--ghost" onClick={() => { setMethod('skip'); next() }}>
              {t('common.skip')}
            </button>
          </div>
        }
      >
        <div className="mz-chips">
          {opts.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={method === m} className="mz-chip" onClick={() => setMethod(m)}>
              {method === m && <span aria-hidden="true">✓</span>}
              {t(`ob.method.${m}` as MessageKey)}
            </button>
          ))}
        </div>
        {(method === 'pill' || method === 'patch-ring' || method === 'iud-implant-shot') && (
          <p className="mz-body-sm mz-muted" style={{ marginTop: 16 }}>{t('ob.method.hormonal')}</p>
        )}
      </Frame>
    )
  }

  // ---------- 5 · Reminders ----------
  if (step === 5) {
    return (
      <Frame
        step={5}
        title={t('ob.remind.title')}
        helper={t('ob.remind.helper')}
        onBack={back}
        action={
          <button
            type="button"
            className="mz-btn mz-btn--primary mz-btn--block"
            onClick={async () => {
              if (tone !== 'off') await requestReminderPermission().catch(() => false)
              next()
            }}
          >
            {t('common.continue')}
          </button>
        }
      >
        <div className="mz-list" role="radiogroup">
          {(['warm', 'neutral', 'minimal', 'off'] as const).map((id) => (
            <button key={id} type="button" role="radio" aria-checked={tone === id} className="mz-list-row" onClick={() => setTone(id)}>
              <span className="mz-list-row__text">
                <span className="mz-list-row__title">{t(`tone.${id}`)}</span>
                <span className="mz-list-row__sub">{t(`tone.${id}.sub` as MessageKey)}</span>
              </span>
              <span className="mz-list-row__end">{tone === id && <Icon name="check" size={20} style={{ color: 'var(--primary-hi)' }} />}</span>
            </button>
          ))}
        </div>
      </Frame>
    )
  }

  // ---------- 6 · App lock ----------
  return (
    <Frame
      step={6}
      title={t('ob.lock.title')}
      helper={t('ob.lock.helper')}
      onBack={back}
      action={
        <div className="mz-stack" style={{ gap: 8 }}>
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" disabled={saving || pin.length !== 4} onClick={() => void finish(true)}>
            {t('ob.lock.set')}
          </button>
          <button type="button" className="mz-btn mz-btn--ghost" disabled={saving} onClick={() => void finish(false)}>
            {t('ob.lock.notNow')}
          </button>
        </div>
      }
    >
      <input
        className="mz-input"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="off"
        aria-label={t('lock.choosePin')}
        value={pin}
        onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
        style={{ fontSize: 28, letterSpacing: '0.5em', textAlign: 'center' }}
      />
      <p className="mz-caption" style={{ marginTop: 12 }}>{t('ob.lock.note')}</p>
    </Frame>
  )
}
