import { App as NativeApp } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { PinLock } from './components/PinLock'
import { ensureHealthProfile, getSetting, SK } from './db/schema'
import { t } from './i18n'
import { setPrivacyScreen } from './native/privacy'
import { isNative } from './native/runtime'
import { scheduleAllReminders } from './native/schedule'
import { OwnerApp } from './OwnerApp'
import { PartnerApp } from './partner/PartnerApp'
import { OnboardingFlow } from './screens/owner/OnboardingFlow'
import { useApp } from './state/appStore'
import { applyTheme, usePrefs } from './state/prefs'
import './styles/meztli.css'

export default function App() {
  const locked = useApp((s) => s.locked)
  const setLocked = useApp((s) => s.setLocked)
  const prefs = usePrefs()
  const [ready, setReady] = useState(false)
  const [onboarded, setOnboarded] = useState(false)

  useEffect(() => {
    // Persist legacy/fresh-install profile state outside Dexie's read-only
    // liveQuery context.
    void ensureHealthProfile().catch((error: unknown) => {
      console.error('[Meztli startup] Could not persist the health profile migration.', error)
    })
  }, [])

  const flags = useLiveQuery(async () => {
    const [ob, pin] = await Promise.all([getSetting(SK.onboarded), getSetting(SK.pinHash)])
    return { ob: ob === '1', hasPin: Boolean(pin) }
  }, [])

  useEffect(() => {
    if (flags === undefined) return
    setOnboarded(flags.ob)
    if (flags.hasPin && !ready) setLocked(true)
    setReady(true)
  }, [flags, setLocked, ready])

  useEffect(() => {
    if (!prefs) return
    applyTheme(prefs.theme)
    void setPrivacyScreen(prefs.hideInSwitcher)
  }, [prefs?.theme, prefs?.hideInSwitcher])

  // Day Bloom follows the OS when the theme is "system".
  useEffect(() => {
    if (prefs?.theme !== 'system' || typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyTheme('system')
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [prefs?.theme])

  // Reminders are recomputed from local data on launch and whenever the app returns.
  useEffect(() => {
    if (!onboarded || prefs?.role !== 'owner') return
    void scheduleAllReminders().catch(() => undefined)
  }, [onboarded, prefs?.role])

  useEffect(() => {
    if (!isNative) return
    let listener: PluginListenerHandle | undefined
    void NativeApp.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive && (await getSetting(SK.pinHash))) setLocked(true)
      if (isActive) void scheduleAllReminders().catch(() => undefined)
    }).then((handle) => {
      listener = handle
    })
    return () => {
      void listener?.remove()
    }
  }, [setLocked])

  if (!ready || !prefs) return <div className="mz-app" role="status" aria-label={t('app.loading')} />
  if (!onboarded || prefs.role === null) return <OnboardingFlow onDone={() => setOnboarded(true)} />
  if (locked) return <PinLock />
  if (prefs.role === 'partner') return <PartnerApp />
  return <OwnerApp prefs={prefs} locked={locked} />
}
