/**
 * App lock. Fingerprint or face first when she turned it on, the PIN as the
 * fallback. Wrong PINs add a growing wait that survives restarting the app.
 * Forgetting the PIN leaves one honest way out: erasing the data it protects.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { hashPin } from '../crypto/vault'
import { getSetting, setSetting, SK } from '../db/schema'
import { useT } from '../i18n'
import { authenticateWithBiometrics, getBiometricStatus } from '../native/biometrics'
import { DeleteSheet } from '../screens/owner/PrivacyScreen'
import { useApp } from '../state/appStore'
import { Icon } from '../ui/icons'

const FAILS = 'lock.fails'
const UNTIL = 'lock.until'

/** Seconds to wait after `fails` wrong PINs: none for the first four, then 30 s doubling to 15 min. */
export function lockoutSeconds(fails: number): number {
  if (fails < 5) return 0
  return Math.min(30 * 2 ** Math.floor((fails - 5) / 5), 15 * 60)
}

export function PinLock() {
  const t = useT()
  const setLocked = useApp((s) => s.setLocked)
  const [entered, setEnteredState] = useState('')
  // The ref is the source of truth so fast typing never reads a stale value,
  // and `checking` ignores input between a full entry and the reset.
  const enteredRef = useRef('')
  const checking = useRef(false)
  const setEntered = useCallback((next: string | ((x: string) => string)) => {
    enteredRef.current = typeof next === 'function' ? next(enteredRef.current) : next
    setEnteredState(enteredRef.current)
  }, [])
  const [wrong, setWrong] = useState(false)
  const [bio, setBio] = useState(false)
  const [busy, setBusy] = useState(false)
  const [bioError, setBioError] = useState(false)
  const [waitUntil, setWaitUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [forgot, setForgot] = useState(false)
  const waiting = waitUntil > now

  const unlockWithBio = useCallback(async () => {
    setBusy(true)
    setBioError(false)
    try {
      const r = await authenticateWithBiometrics(t('lock.bioReason'))
      if (r.authenticated) {
        await setSetting(FAILS, '0')
        setLocked(false)
      } else if (r.errorCode && r.errorCode !== 'USER_CANCEL') setBioError(true)
    } catch {
      setBioError(true)
    } finally {
      setBusy(false)
    }
  }, [setLocked, t])

  useEffect(() => {
    let alive = true
    void (async () => {
      setWaitUntil(Number((await getSetting(UNTIL)) ?? 0))
      if ((await getSetting(SK.biometricLock)) !== '1') return
      const status = await getBiometricStatus()
      if (!alive || !status.available || !status.enrolled) return
      setBio(true)
      await unlockWithBio()
    })().catch(() => undefined)
    return () => {
      alive = false
    }
  }, [unlockWithBio])

  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [waiting])

  const press = useCallback(
    async (d: string) => {
      if (waiting || busy || checking.current) return
      setWrong(false)
      const next = (enteredRef.current + d).slice(0, 4)
      setEntered(next)
      if (next.length < 4) return
      checking.current = true
      const [salt, hash] = await Promise.all([getSetting(SK.pinSalt), getSetting(SK.pinHash)])
      if (salt && hash && (await hashPin(next, salt)) === hash) {
        await setSetting(FAILS, '0')
        checking.current = false
        setLocked(false)
        return
      }
      const fails = Number((await getSetting(FAILS)) ?? 0) + 1
      await setSetting(FAILS, String(fails))
      const wait = lockoutSeconds(fails)
      if (wait) {
        const until = Date.now() + wait * 1000
        await setSetting(UNTIL, String(until))
        setWaitUntil(until)
        setNow(Date.now())
      }
      setWrong(true)
      window.setTimeout(() => {
        setEntered('')
        checking.current = false
      }, 300)
    },
    [waiting, busy, setLocked, setEntered],
  )

  // A hardware keyboard works too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (forgot) return
      if (/^\d$/.test(e.key)) void press(e.key)
      else if (e.key === 'Backspace') setEntered((x) => x.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, forgot])

  const status = waiting
    ? t('lock.wait', { n: Math.ceil((waitUntil - now) / 1000) })
    : wrong
      ? t('lock.wrong')
      : bioError
        ? t('lock.bioFailed')
        : ''

  return (
    <div className="mz-overlay mz-lock" role="dialog" aria-modal="true" aria-labelledby="mz-lock-title">
      <div className="mz-lock__body">
        <Icon name="lock-simple" size={28} className="mz-faint" />
        <h1 id="mz-lock-title" className="mz-title-lg">{t('lock.enter')}</h1>
        <div className={`mz-lock__dots${wrong ? ' is-wrong' : ''}`} role="img" aria-label={t('lock.progress', { n: entered.length })}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={entered.length > i ? 'is-filled' : undefined} />
          ))}
        </div>
        <p className="mz-body-sm mz-lock__status" role="status" aria-live="assertive">{status}</p>
        <div className="mz-lock__pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button key={k} type="button" className="mz-lock__key" disabled={waiting} onClick={() => void press(k)}>
              {k}
            </button>
          ))}
          {bio ? (
            <button type="button" className="mz-lock__key mz-lock__key--icon" aria-label={t('lock.useBio')} disabled={busy} onClick={() => void unlockWithBio()}>
              <Icon name="fingerprint" size={26} />
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="mz-lock__key" disabled={waiting} onClick={() => void press('0')}>
            0
          </button>
          <button
            type="button"
            className="mz-lock__key mz-lock__key--icon"
            aria-label={t('lock.backspace')}
            disabled={!entered}
            onClick={() => setEntered((x) => x.slice(0, -1))}
          >
            <Icon name="backspace" size={24} />
          </button>
        </div>
        <button type="button" className="mz-link" onClick={() => setForgot(true)}>
          {t('lock.forgot')}
        </button>
      </div>
      {forgot && <DeleteSheet onClose={() => setForgot(false)} intro={t('lock.forgot.body')} />}
    </div>
  )
}
