/**
 * Owner — partner sharing (spec §5.7). Scopes are chosen before the handshake
 * completes; the owner confirms the partner's device by matching four words;
 * pause is instant and silent; revoke is honest about its limits.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import qrcode from 'qrcode-generator'
import { SYMPTOMS } from '../db/taxonomy'
import { useT, type MessageKey } from '../i18n'
import { relativeAgo } from '../i18n/dates'
import { useNav } from '../state/nav'
import type { CycleData } from '../state/useCycle'
import { Icon } from '../ui/icons'
import { Banner, ListRow, Screen, SectionTitle, Sheet, SwitchRow } from '../ui/kit'
import { symptomLabel } from '../screens/owner/labels'
import { supportsX25519 } from './crypto'
import { cancelOwnerPairing, confirmOwnerPairing, hostOf, pollOwnerPairing, revokePartner, startOwnerPairing, type OwnerPairing, type PendingConfirm } from './pairing'
import { DEFAULT_RELAY_URL, RelayError } from './relay'
import { buildSnapshot, NEVER_SHARED_KEYS } from './snapshot'
import { DEFAULT_SCOPES, readPartner, writePartner, type PartnerScopes } from './store'
import { uploadNow } from './sync'
import { PartnerTodayView } from './PartnerApp'

export function NeverSharedList() {
  const t = useT()
  return (
    <div className="mz-section mz-card mz-card--raised mz-stack" style={{ gap: 6 }}>
      <div className="mz-label">{t('partner.never.title')}</div>
      <p className="mz-body-sm mz-muted">{NEVER_SHARED_KEYS.map((k) => t(k)).join(' · ')}</p>
    </div>
  )
}

function ScopeEditor({ scopes, onChange, partnerName }: { scopes: PartnerScopes; onChange: (s: PartnerScopes) => void; partnerName: string }) {
  const t = useT()
  const [picking, setPicking] = useState(false)
  const name = partnerName || t('partner.them')
  return (
    <>
      <div className="mz-section mz-list">
        <SwitchRow title={t('partner.scope.phase')} sub={t('partner.scope.phase.sub')} checked={scopes.phase} onChange={(v) => onChange({ ...scopes, phase: v })} />
        <SwitchRow title={t('partner.scope.range')} sub={t('partner.scope.range.sub')} checked={scopes.range} onChange={(v) => onChange({ ...scopes, range: v })} />
        <SwitchRow title={t('partner.scope.support')} sub={t('partner.scope.support.sub')} checked={scopes.support} onChange={(v) => onChange({ ...scopes, support: v })} />
        <ListRow
          title={t('partner.scope.symptoms')}
          sub={scopes.symptoms.length ? scopes.symptoms.map((s) => symptomLabel(s, t)).join(', ') : t('partner.scope.symptoms.none')}
          onClick={() => setPicking(true)}
        />
      </div>
      <p className="mz-caption mz-gutter">{t('partner.scope.note', { name })}</p>
      {picking && (
        <Sheet title={t('partner.scope.symptoms')} subtitle={t('partner.scope.symptoms.pick')} onClose={() => setPicking(false)}>
          <div className="mz-chips">
            {(SYMPTOMS as readonly string[]).map((s) => {
              const on = scopes.symptoms.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  className="mz-chip"
                  aria-pressed={on}
                  onClick={() => onChange({ ...scopes, symptoms: on ? scopes.symptoms.filter((x) => x !== s) : [...scopes.symptoms, s] })}
                >
                  {on && <span aria-hidden="true">✓</span>}
                  {symptomLabel(s, t)}
                </button>
              )
            })}
          </div>
        </Sheet>
      )}
    </>
  )
}

export function PartnerOwnerScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop, push } = useNav()
  const partner = useLiveQuery(readPartner, [])
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [preview, setPreview] = useState(false)
  const [support, setSupport] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (!partner) return null

  if (partner.status !== 'paired') {
    return (
      <Screen title={t('you.partner')} onBack={pop}>
        <section className="mz-section mz-card mz-stack">
          <div className="mz-title-lg">{t('partner.intro.title')}</div>
          <p className="mz-body mz-muted">{t('partner.intro.body')}</p>
          <p className="mz-body-sm mz-muted">{t('partner.intro.how')}</p>
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => push({ name: 'partner-pair' })}>
            {t('partner.invite')}
          </button>
        </section>
        <NeverSharedList />
      </Screen>
    )
  }

  const snapshot = buildSnapshot({ partner, state: data.state, todayLog: data.logsByDate.get(data.today), now: new Date().toISOString() })

  return (
    <Screen title={t('you.partner')} onBack={pop}>
      <section className="mz-section mz-card mz-stack" style={{ gap: 6 }}>
        <div className="mz-title">{t('partner.pairedWith', { name: partner.partnerName })}</div>
        <p className="mz-body-sm mz-muted">
          {partner.paused
            ? t('partner.status.paused')
            : partner.lastUploadAt
              ? t('partner.status.sent', { when: relativeAgo(partner.lastUploadAt, now, t.locale) })
              : t('partner.status.none')}
        </p>
        {partner.lastUploadError && !partner.paused && <p className="mz-caption">{t('partner.status.error')}</p>}
      </section>

      <div className="mz-section mz-list">
        <SwitchRow
          title={t('partner.pause')}
          sub={t('partner.pause.sub', { name: partner.partnerName })}
          checked={partner.paused}
          onChange={async (v) => {
            await writePartner({ paused: v })
            void uploadNow(data, true)
          }}
        />
      </div>

      <SectionTitle>{t('partner.theyWillSee')}</SectionTitle>
      <ScopeEditor scopes={partner.scopes} partnerName={partner.partnerName} onChange={(scopes) => void writePartner({ scopes })} />

      <SectionTitle>{t('partner.support.title')}</SectionTitle>
      <div className="mz-section mz-list">
        {partner.supportLines.map((line, i) => (
          <ListRow key={i} title={line} onClick={() => setSupport(String(i))} />
        ))}
        {partner.supportLines.length < 6 && <ListRow icon="plus-circle" title={t('partner.support.add')} onClick={() => setSupport('new')} />}
      </div>
      <p className="mz-caption mz-gutter">{t('partner.support.note')}</p>

      <div className="mz-section mz-stack" style={{ marginTop: 'var(--space-4)' }}>
        <button type="button" className="mz-btn mz-btn--secondary mz-btn--block" onClick={() => setPreview(true)}>
          <Icon name="eye" size={20} /> {t('partner.preview', { name: partner.partnerName })}
        </button>
      </div>

      <NeverSharedList />

      <div className="mz-section mz-stack">
        {!confirmRevoke ? (
          <button type="button" className="mz-btn mz-btn--danger mz-btn--block" onClick={() => setConfirmRevoke(true)}>
            {t('partner.revoke')}
          </button>
        ) : (
          <div className="mz-card mz-stack">
            <p className="mz-body-sm">{t('partner.revoke.confirm', { name: partner.partnerName })}</p>
            <div className="mz-row">
              <button type="button" className="mz-btn mz-btn--secondary mz-grow" data-autofocus onClick={() => setConfirmRevoke(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="mz-btn mz-btn--danger-solid mz-grow"
                onClick={async () => {
                  void import('../native/runtime').then((m) => m.destructiveTap())
                  await revokePartner()
                  pop()
                }}
              >
                {t('partner.revoke.go')}
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mz-caption mz-gutter">{t('partner.relayLine', { host: hostOf(partner.relayUrl) })}</p>

      {preview && (
        <Sheet full title={t('partner.preview', { name: partner.partnerName })} onClose={() => setPreview(false)}>
          <div style={{ margin: '0 -20px' }}>
            <PartnerTodayView snapshot={snapshot} fetchedAt={new Date().toISOString()} ownerName={partner.ownerName} />
          </div>
        </Sheet>
      )}
      {support !== null && (
        <SupportLineSheet
          initial={support === 'new' ? '' : partner.supportLines[Number(support)]}
          onClose={() => setSupport(null)}
          onSave={async (text) => {
            const lines = [...partner.supportLines]
            if (support === 'new') lines.push(text)
            else if (text) lines[Number(support)] = text
            else lines.splice(Number(support), 1)
            await writePartner({ supportLines: lines.filter(Boolean) })
            setSupport(null)
          }}
        />
      )}
    </Screen>
  )
}

function SupportLineSheet({ initial, onSave, onClose }: { initial: string; onSave: (text: string) => void; onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState(initial)
  return (
    <Sheet
      title={t('partner.support.title')}
      onClose={onClose}
      footer={
        <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => onSave(text.trim())}>
          {text.trim() || !initial ? t('common.save') : t('common.remove')}
        </button>
      }
    >
      <input className="mz-input" value={text} maxLength={80} onChange={(e) => setText(e.currentTarget.value)} placeholder={t('partner.support.hint')} data-autofocus />
      <p className="mz-caption" style={{ marginTop: 8 }}>{t('partner.support.verbatim')}</p>
    </Sheet>
  )
}

function QrCode({ text }: { text: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
  }, [text])
  return <div className="mz-qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}

export function PartnerPairScreen() {
  const t = useT()
  const { pop } = useNav()
  const existing = useLiveQuery(readPartner, [])
  const [step, setStep] = useState<'setup' | 'code' | 'confirm' | 'done'>('setup')
  const [ownerName, setOwnerName] = useState('')
  const [relayUrl, setRelayUrl] = useState(DEFAULT_RELAY_URL)
  const [scopes, setScopes] = useState<PartnerScopes>(DEFAULT_SCOPES)
  const [pairing, setPairing] = useState<OwnerPairing | null>(null)
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)
  const announced = useRef(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    void supportsX25519().then(setSupported)
  }, [])
  useEffect(() => {
    if (existing?.ownerName && !ownerName) setOwnerName(existing.ownerName)
    if (existing?.relayUrl && !relayUrl) setRelayUrl(existing.relayUrl)
  }, [existing, ownerName, relayUrl])

  // Countdown and polling while the code is live.
  useEffect(() => {
    if (step !== 'code' || !pairing) return
    const tick = window.setInterval(async () => {
      const left = Math.max(0, Math.round((pairing.expiresAt - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) return
      try {
        const answer = await pollOwnerPairing(pairing)
        if (answer) {
          setPending(answer)
          setStep('confirm')
        }
      } catch {
        // transient network errors: keep polling until expiry
      }
    }, 2000)
    return () => window.clearInterval(tick)
  }, [step, pairing])

  async function begin() {
    setError(null)
    try {
      const p = await startOwnerPairing(relayUrl.trim(), ownerName.trim())
      setPairing(p)
      setRemaining(Math.round((p.expiresAt - Date.now()) / 1000))
      announced.current = false
      setStep('code')
    } catch (e) {
      setError(e instanceof RelayError ? t(`partner.err.${e.code === 'no-relay' || e.code === 'offline' ? e.code : 'generic'}` as MessageKey) : t('partner.err.generic'))
    }
  }

  const leave = async () => {
    if (pairing && step !== 'done') await cancelOwnerPairing(pairing)
    pop()
  }

  return (
    <Screen title={t('partner.invite')} onBack={() => void leave()}>
      {!supported && (
        <div className="mz-section">
          <Banner tone="info" icon="info">{t('partner.err.crypto')}</Banner>
        </div>
      )}
      {step === 'setup' && (
        <>
          <section className="mz-section mz-stack" style={{ gap: 14 }}>
            <label className="mz-field">
              <span className="mz-field__label">{t('partner.setup.yourName')}</span>
              <input className="mz-input" value={ownerName} maxLength={30} onChange={(e) => setOwnerName(e.currentTarget.value)} />
              <span className="mz-field__help">{t('partner.setup.yourNameHelp')}</span>
            </label>
          </section>
          <SectionTitle>{t('partner.theyWillSee')}</SectionTitle>
          <ScopeEditor scopes={scopes} onChange={setScopes} partnerName="" />
          <NeverSharedList />
          <SectionTitle>{t('partner.relay')}</SectionTitle>
          <section className="mz-section mz-stack" style={{ gap: 8 }}>
            <input className="mz-input" value={relayUrl} inputMode="url" autoCapitalize="none" onChange={(e) => setRelayUrl(e.currentTarget.value)} placeholder="https://meztli-relay.example.workers.dev" aria-label={t('partner.relay')} />
            <p className="mz-caption">{t('partner.relayHelp')}</p>
          </section>
          {error && (
            <div className="mz-section">
              <Banner tone="info" icon="wifi-slash">{error}</Banner>
            </div>
          )}
          <div className="mz-section">
            <button type="button" className="mz-btn mz-btn--primary mz-btn--block" disabled={!ownerName.trim() || !relayUrl.trim() || !supported} onClick={() => void begin()}>
              {t('partner.showCode')}
            </button>
          </div>
        </>
      )}

      {step === 'code' && pairing && (
        <section className="mz-section mz-stack" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
          {remaining > 0 ? (
            <>
              <QrCode text={pairing.link} />
              <div className="mz-caption">{t('partner.orType')}</div>
              <div className="mz-code" aria-label={t('partner.codeAria', { code: pairing.code.split('').join(' ') })}>
                {pairing.code.slice(0, 3)} · {pairing.code.slice(3)}
              </div>
              <div className="mz-pill" aria-live={remaining <= 30 && !announced.current ? 'assertive' : 'off'}>
                {t('partner.expires', { time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` })}
              </div>
              <p className="mz-body-sm mz-muted" style={{ maxWidth: '34ch' }}>{t('partner.holdTogether')}</p>
              <p className="mz-caption">{t('partner.confirmFirst')}</p>
              <div className="mz-row mz-muted" style={{ gap: 8 }}>
                <span className="mz-sr-only" role="status">{t('partner.waiting')}</span>
                <Icon name="hourglass" size={18} />
                <span className="mz-body-sm">{t('partner.waiting')}</span>
              </div>
            </>
          ) : (
            <>
              <div className="mz-title">{t('partner.expired')}</div>
              <button type="button" className="mz-btn mz-btn--primary" onClick={() => void begin()}>
                {t('partner.newCode')}
              </button>
            </>
          )}
        </section>
      )}

      {step === 'confirm' && pending && pairing && (
        <section className="mz-section mz-stack" style={{ gap: 14 }}>
          <div className="mz-title-lg">{t('partner.confirm.title', { name: pending.partnerName || t('partner.them') })}</div>
          <p className="mz-body mz-muted">{t('partner.confirm.body')}</p>
          <div className="mz-card mz-stack" style={{ alignItems: 'center', gap: 6 }}>
            <div className="mz-title-lg" style={{ letterSpacing: '0.02em' }}>{pending.words.join(' · ')}</div>
          </div>
          <button
            type="button"
            className="mz-btn mz-btn--primary mz-btn--block"
            onClick={async () => {
              await confirmOwnerPairing(pairing, pending, scopes)
              setStep('done')
            }}
          >
            {t('partner.confirm.yes')}
          </button>
          <button
            type="button"
            className="mz-btn mz-btn--secondary mz-btn--block"
            onClick={async () => {
              await cancelOwnerPairing(pairing)
              setPending(null)
              setPairing(null)
              setStep('setup')
              setError(t('partner.confirm.mismatch'))
            }}
          >
            {t('partner.confirm.no')}
          </button>
        </section>
      )}

      {step === 'done' && (
        <section className="mz-section mz-card mz-stack" style={{ gap: 10 }}>
          <Icon name="check-circle:fill" size={32} style={{ color: 'var(--care)' }} />
          <div className="mz-title">{t('partner.done.title')}</div>
          <p className="mz-body-sm mz-muted">{t('partner.done.body')}</p>
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={pop}>
            {t('common.done')}
          </button>
        </section>
      )}
    </Screen>
  )
}
