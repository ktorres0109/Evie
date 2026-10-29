/**
 * The partner app (spec §5.8): a separate, smaller shell. Four destinations,
 * read-only, nothing that expands into data, no history, no charts. A phrase
 * instead of metrics, a softened range, support lines the owner wrote, and an
 * always-honest staleness footer.
 */
import { App as NativeApp } from '@capacitor/app'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useLocale, useT, type LocalePreference, type MessageKey, type Translator } from '../i18n'
import { relativeAgo } from '../i18n/dates'
import { useNav, type PartnerTab } from '../state/nav'
import { updatePrefs } from '../state/prefs'
import { Icon } from '../ui/icons'
import { Banner, BrandBar, SectionTitle } from '../ui/kit'
import { NavBar } from '../ui/NavBar'
import { symptomLabel } from '../screens/owner/labels'
import { NEVER_SHARED_KEYS } from './snapshot'
import { fetchSnapshot, joinAsPartner, parsePairLink } from './pairing'
import { DEFAULT_RELAY_URL, RelayError } from './relay'
import { clearViewer, readViewer, writeViewer, type PartnerSnapshot, type ViewerState } from './store'

const STALE_MS = 72 * 60 * 60 * 1000

function ordinalDay(iso: string, t: Translator): string {
  const d = Number(iso.slice(8))
  if (t.locale === 'es') return String(d)
  const suffix = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'
  return `${d}${suffix}`
}

export function PartnerTodayView({ snapshot, fetchedAt, ownerName }: { snapshot: PartnerSnapshot | null; fetchedAt: string | null; ownerName: string }) {
  const t = useT()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const name = snapshot?.ownerName || ownerName
  const issued = snapshot?.issuedAt ?? null
  const stale = issued ? now - new Date(issued).getTime() > STALE_MS : false

  return (
    <div className="mz-page" style={stale ? { opacity: 0.6 } : undefined}>
      <BrandBar trailing={<span className="mz-pill">{t('pview.readOnly')}</span>} />
      {!snapshot ? (
        <section className="mz-section mz-card">
          <p className="mz-body">{t('pview.nothingYet', { name })}</p>
        </section>
      ) : snapshot.paused ? (
        <section className="mz-hero">
          <div className="mz-display-md">{t('pview.paused')}</div>
        </section>
      ) : (
        <>
          <section className="mz-hero">
            <div className="mz-caption" style={{ marginBottom: 8 }}>{t('pview.shared', { name })}</div>
            {snapshot.phase !== undefined ? (
              <>
                <div className="mz-display-md">{t(`pview.phase.${snapshot.phase}.a` as MessageKey)}</div>
                <div className="mz-display-md mz-muted" style={{ fontWeight: 500 }}>{t(`pview.phase.${snapshot.phase}.b` as MessageKey)}</div>
              </>
            ) : (
              <div className="mz-title-lg">{t('pview.noPhase')}</div>
            )}
          </section>

          {snapshot.range !== undefined && (
            <section className="mz-section mz-card">
              {snapshot.range ? (
                <>
                  <div className="mz-caption" style={{ marginBottom: 6 }}>{t('pview.mightCome')}</div>
                  <div className="mz-title">{t('pview.around', { a: ordinalDay(snapshot.range.start, t), b: ordinalDay(snapshot.range.end, t) })}</div>
                  <p className="mz-body-sm mz-muted" style={{ marginTop: 6 }}>{t('pview.itMoves')}</p>
                </>
              ) : (
                <p className="mz-body-sm mz-muted">{t('pview.noRange')}</p>
              )}
            </section>
          )}

          {snapshot.support && snapshot.support.length > 0 && (
            <section className="mz-section mz-card mz-stack" style={{ gap: 10 }}>
              <div className="mz-label">{t('pview.helps')}</div>
              {snapshot.support.map((line, i) => (
                <div key={i} className="mz-row" style={{ alignItems: 'flex-start' }}>
                  <Icon name="hand-heart" size={18} style={{ color: 'var(--care)', marginTop: 2, flex: 'none' }} />
                  <p className="mz-body">{line}</p>
                </div>
              ))}
              <p className="mz-caption">{t('pview.sheWrote')}</p>
            </section>
          )}

          {snapshot.symptoms && snapshot.symptoms.length > 0 && (
            <section className="mz-section mz-card">
              <div className="mz-caption" style={{ marginBottom: 6 }}>{t('pview.notedToday')}</div>
              <p className="mz-body">{snapshot.symptoms.map((s) => symptomLabel(s, t)).join(', ')}</p>
            </section>
          )}

          <section className="mz-section mz-card mz-card--raised">
            <p className="mz-body-sm mz-muted">{t('pview.antiStereotype')}</p>
          </section>
        </>
      )}

      <p className="mz-caption mz-gutter" style={{ marginTop: 12 }}>
        {issued ? t('pview.updated', { when: relativeAgo(issued, now, t.locale) }) : fetchedAt ? t('pview.checked', { when: relativeAgo(fetchedAt, now, t.locale) }) : ''}
        {stale ? ` ${t('pview.stale')}` : ''}
      </p>
    </div>
  )
}

function PartnerJoin({ viewer, initialCode, initialRelay }: { viewer: ViewerState; initialCode: string; initialRelay: string }) {
  const t = useT()
  const [name, setName] = useState('')
  const [code, setCode] = useState(initialCode)
  const [relayUrl, setRelayUrl] = useState(initialRelay || DEFAULT_RELAY_URL)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRelay, setShowRelay] = useState(!relayUrl)

  useEffect(() => {
    if (initialCode) setCode(initialCode)
    if (initialRelay) setRelayUrl(initialRelay)
  }, [initialCode, initialRelay])

  if (viewer.status === 'pending') {
    return (
      <div className="mz-page mz-page--flush-bottom">
        <BrandBar />
        <section className="mz-section mz-stack" style={{ gap: 14 }}>
          <div className="mz-title-lg">{t('pjoin.check.title')}</div>
          <p className="mz-body mz-muted">{t('pjoin.check.body', { name: viewer.ownerName })}</p>
          <div className="mz-card" style={{ textAlign: 'center' }}>
            <div className="mz-title-lg" style={{ letterSpacing: '0.02em' }}>{viewer.words.join(' · ')}</div>
          </div>
          <p className="mz-caption">{t('pjoin.check.wait')}</p>
          <button
            type="button"
            className="mz-btn mz-btn--ghost"
            onClick={async () => {
              await clearViewer()
            }}
          >
            {t('pjoin.startOver')}
          </button>
        </section>
      </div>
    )
  }

  async function join() {
    setBusy(true)
    setError(null)
    try {
      await joinAsPartner(relayUrl.trim(), code, name.trim())
    } catch (e) {
      const c = e instanceof RelayError ? e.code : 'generic'
      setError(t(`pjoin.err.${c === 'not-found' || c === 'used' || c === 'offline' || c === 'no-relay' ? c : 'generic'}` as MessageKey))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mz-page mz-page--flush-bottom">
      <BrandBar />
      <section className="mz-section mz-stack" style={{ gap: 16 }}>
        {viewer.status === 'revoked' && (
          <Banner tone="info" icon="link-break" title={t('pjoin.revoked.title')}>
            {t('pjoin.revoked.body')}
          </Banner>
        )}
        <div className="mz-title-lg">{t('pjoin.title')}</div>
        <p className="mz-body mz-muted">{t('pjoin.body')}</p>
        <label className="mz-field">
          <span className="mz-field__label">{t('pjoin.yourName')}</span>
          <input className="mz-input" value={name} maxLength={30} onChange={(e) => setName(e.currentTarget.value)} />
        </label>
        <div className="mz-card mz-card--raised mz-stack" style={{ gap: 6 }}>
          <div className="mz-row">
            <Icon name="qr-code" size={22} />
            <strong style={{ fontWeight: 500 }}>{t('pjoin.scan')}</strong>
          </div>
          <p className="mz-body-sm mz-muted">{t('pjoin.scanHow')}</p>
        </div>
        <label className="mz-field">
          <span className="mz-field__label">{t('pjoin.orCode')}</span>
          <input
            className="mz-input"
            value={code}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={9}
            onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
            style={{ fontSize: 22, letterSpacing: '0.2em', textAlign: 'center' }}
          />
        </label>
        {showRelay ? (
          <label className="mz-field">
            <span className="mz-field__label">{t('partner.relay')}</span>
            <input className="mz-input" value={relayUrl} inputMode="url" autoCapitalize="none" onChange={(e) => setRelayUrl(e.currentTarget.value)} />
          </label>
        ) : (
          <button type="button" className="mz-link" onClick={() => setShowRelay(true)}>{t('pjoin.relayEdit')}</button>
        )}
        {error && <Banner tone="info" icon="info">{error}</Banner>}
        <button type="button" className="mz-btn mz-btn--primary mz-btn--block" disabled={busy || !name.trim() || code.replace(/[^A-Z0-9]/gi, '').length !== 6 || !relayUrl} onClick={() => void join()}>
          {t('pjoin.join')}
        </button>
        <button type="button" className="mz-btn mz-btn--ghost" onClick={() => void updatePrefs({ role: null })}>
          {t('pjoin.notPartner')}
        </button>
      </section>
    </div>
  )
}

export function PartnerApp() {
  const t = useT()
  const viewer = useLiveQuery(readViewer, [])
  const { tab, setTab } = useNav()
  const [link, setLink] = useState<{ code: string; relayUrl: string } | null>(null)
  const preference = useLocale((s) => s.preference)
  const setPreference = useLocale((s) => s.setPreference)
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    if (!String(tab).startsWith('p-')) setTab('p-today')
  }, [tab, setTab])

  // Pairing links from the camera: meztli://pair?c=…&r=…
  useEffect(() => {
    const handle = NativeApp.addListener('appUrlOpen', ({ url }) => {
      const parsed = parsePairLink(url)
      if (parsed) setLink(parsed)
    })
    void NativeApp.getLaunchUrl?.()
      .then((r) => {
        const parsed = r?.url ? parsePairLink(r.url) : null
        if (parsed) setLink(parsed)
      })
      .catch(() => undefined)
    return () => {
      void handle.then((h) => h.remove())
    }
  }, [])

  // Pull on open, on resume, and every 15 minutes while open.
  useEffect(() => {
    if (!viewer || (viewer.status !== 'paired' && viewer.status !== 'pending')) return
    void fetchSnapshot()
    const interval = window.setInterval(() => void fetchSnapshot(), viewer.status === 'pending' ? 3000 : 15 * 60 * 1000)
    const resume = NativeApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void fetchSnapshot()
    })
    return () => {
      window.clearInterval(interval)
      void resume.then((h) => h.remove())
    }
  }, [viewer?.status])

  if (!viewer) return <div className="mz-app" />
  if (viewer.status !== 'paired') {
    return (
      <div className="mz-app">
        <main className="mz-main">
          <PartnerJoin viewer={viewer} initialCode={link?.code ?? ''} initialRelay={link?.relayUrl ?? ''} />
        </main>
      </div>
    )
  }

  const snap = viewer.lastSnapshot
  return (
    <div className="mz-app">
      <main className="mz-main">
        {tab === 'p-today' && <PartnerTodayView snapshot={snap} fetchedAt={viewer.lastFetchedAt} ownerName={viewer.ownerName} />}
        {tab === 'p-support' && (
          <div className="mz-page">
            <header className="mz-appbar">
              <h1 className="mz-h1">{t('nav.support')}</h1>
            </header>
            {snap?.support?.length && !snap.paused ? (
              <section className="mz-section mz-card mz-stack" style={{ gap: 12 }}>
                {snap.support.map((line, i) => (
                  <p key={i} className="mz-body">{line}</p>
                ))}
                <p className="mz-caption">{t('pview.sheWrote')}</p>
              </section>
            ) : (
              <p className="mz-body-sm mz-muted mz-gutter">{snap?.paused ? t('pview.paused') : t('psupport.empty', { name: viewer.ownerName })}</p>
            )}
            <section className="mz-section mz-card mz-card--raised">
              <p className="mz-body-sm mz-muted">{t('psupport.noAdvice')}</p>
            </section>
          </div>
        )}
        {tab === 'p-shared' && (
          <div className="mz-page">
            <header className="mz-appbar">
              <h1 className="mz-h1">{t('nav.shared')}</h1>
            </header>
            <SectionTitle>{t('pshared.is')}</SectionTitle>
            <div className="mz-section mz-list">
              {(['phase', 'range', 'support', 'symptoms'] as const).map((k) => {
                const on =
                  !snap?.paused &&
                  (k === 'phase' ? snap?.phase !== undefined : k === 'range' ? snap?.range !== undefined : k === 'support' ? snap?.support !== undefined : snap?.symptoms !== undefined)
                return (
                  <div key={k} className="mz-list-row" style={{ cursor: 'default' }}>
                    <Icon name={on ? 'check' : 'minus'} size={20} style={{ color: on ? 'var(--care)' : 'var(--text-3)' }} />
                    <span className="mz-list-row__text">
                      <span className="mz-list-row__title">{t(`partner.scope.${k}` as MessageKey)}</span>
                    </span>
                    <span className="mz-list-row__end">{on ? t('pshared.on') : t('pshared.off')}</span>
                  </div>
                )
              })}
            </div>
            <div className="mz-section mz-card mz-card--raised mz-stack" style={{ gap: 6 }}>
              <div className="mz-label">{t('partner.never.title')}</div>
              <p className="mz-body-sm mz-muted">{NEVER_SHARED_KEYS.map((k) => t(k)).join(' · ')}</p>
            </div>
            <p className="mz-caption mz-gutter">{t('pshared.hersToChange', { name: viewer.ownerName })}</p>
          </div>
        )}
        {tab === 'p-you' && (
          <div className="mz-page">
            <header className="mz-appbar">
              <h1 className="mz-h1">{t('nav.you')}</h1>
            </header>
            <section className="mz-section mz-card mz-stack" style={{ gap: 6 }}>
              <div className="mz-title">{t('pyou.pairedWith', { name: viewer.ownerName })}</div>
              <p className="mz-body-sm mz-muted">{t('pyou.encrypted')}</p>
            </section>
            <div className="mz-section mz-list">
              <label className="mz-list-row" style={{ cursor: 'default' }}>
                <span className="mz-list-row__text">
                  <span className="mz-list-row__title">{t('settings.language')}</span>
                </span>
                <select className="mz-select" style={{ width: 'auto', minHeight: 40, border: 0, background: 'transparent' }} value={preference} onChange={(e) => setPreference(e.currentTarget.value as LocalePreference)}>
                  <option value="system">{t('settings.language.system')}</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </label>
              <button type="button" className="mz-list-row" onClick={() => void fetchSnapshot()}>
                <span className="mz-list-row__text">
                  <span className="mz-list-row__title">{t('pyou.refresh')}</span>
                </span>
                <Icon name="arrows-clockwise" size={20} className="mz-faint" />
              </button>
            </div>
            <div className="mz-section">
              {!confirmLeave ? (
                <button type="button" className="mz-btn mz-btn--danger mz-btn--block" onClick={() => setConfirmLeave(true)}>
                  {t('pyou.disconnect')}
                </button>
              ) : (
                <div className="mz-card mz-stack">
                  <p className="mz-body-sm">{t('pyou.disconnectConfirm')}</p>
                  <div className="mz-row">
                    <button type="button" className="mz-btn mz-btn--secondary mz-grow" data-autofocus onClick={() => setConfirmLeave(false)}>
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className="mz-btn mz-btn--danger-solid mz-grow"
                      onClick={async () => {
                        await clearViewer()
                        await writeViewer({ status: 'none' })
                      }}
                    >
                      {t('pyou.disconnect')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <NavBar role="partner" active={tab} onChange={(next) => setTab(next as PartnerTab)} />
    </div>
  )
}
