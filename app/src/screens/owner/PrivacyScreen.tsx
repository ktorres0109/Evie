/**
 * You — Privacy & data (spec §5.10). Grouped by the question a worried person
 * asks: who can get in, who can see it, how do I take it away. The status card
 * reads the transfer ledger, so it can only claim what is true.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { collectExport, encryptedExport, shareOrDownload } from '../../db/transfer'
import { db, getSetting, SK } from '../../db/schema'
import { recordTransfer } from '../../db/ledger'
import { useT, type MessageKey } from '../../i18n'
import { dayMonth } from '../../i18n/dates'
import { localToday } from '../../lib/dates'
import { clearSecureSecrets } from '../../native/secureVault'
import { setPrivacyScreen } from '../../native/privacy'
import { readPartner, writePartner } from '../../partner/store'
import { useNav } from '../../state/nav'
import { updatePrefs, usePrefs } from '../../state/prefs'
import { Icon } from '../../ui/icons'
import { ListRow, Screen, SectionTitle, Sheet, SwitchRow } from '../../ui/kit'

export function PrivacyScreen() {
  const t = useT()
  const { pop, push } = useNav()
  const prefs = usePrefs()
  const partner = useLiveQuery(readPartner, [])
  const hasPin = useLiveQuery(async () => Boolean(await getSetting(SK.pinHash)), [])
  const transfers = useLiveQuery(() => db.transfers.orderBy('at').reverse().toArray(), [])
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const nothingLeft = (transfers?.length ?? 0) === 0
  const byKind = new Map<string, { count: number; last: string; destination: string }>()
  for (const tr of transfers ?? []) {
    const prev = byKind.get(tr.kind)
    byKind.set(tr.kind, { count: (prev?.count ?? 0) + 1, last: prev?.last ?? tr.at, destination: tr.destination })
  }

  return (
    <Screen title={t('privacy.title')} onBack={pop}>
      <section className="mz-section mz-card mz-stack" style={{ gap: 8 }}>
        <div className="mz-row">
          <Icon name={nothingLeft ? 'device-mobile' : 'share-network'} size={24} style={{ color: nothingLeft ? 'var(--care)' : 'var(--primary-hi)' }} />
          <div className="mz-title">{nothingLeft ? t('privacy.status.local') : t('privacy.status.some')}</div>
        </div>
        {nothingLeft ? (
          <p className="mz-body-sm mz-muted">{t('privacy.status.localBody')}</p>
        ) : (
          <ul className="mz-stack" style={{ margin: 0, paddingLeft: 18, gap: 4 }}>
            {[...byKind.entries()].map(([kind, v]) => (
              <li key={kind} className="mz-body-sm mz-muted">
                {t.n(`privacy.ledger.${kind}` as Parameters<typeof t.n>[0], v.count, {
                  date: dayMonth(v.last.slice(0, 10), t.locale),
                  where: v.destination,
                })}
              </li>
            ))}
          </ul>
        )}
        <p className="mz-caption">{t('privacy.status.never')}</p>
      </section>

      <SectionTitle>{t('privacy.gettingIn')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow icon="lock-simple" title={t('you.lock')} sub={hasPin ? t('privacy.lockOn') : t('you.lock.off')} onClick={() => push({ name: 'lock' })} />
        <SwitchRow
          title={t('privacy.switcher')}
          sub={t('privacy.switcher.sub')}
          checked={prefs?.hideInSwitcher ?? true}
          onChange={async (next) => {
            await updatePrefs({ hideInSwitcher: next })
            await setPrivacyScreen(next)
          }}
        />
        <div className="mz-list-row" style={{ cursor: 'default' }}>
          <span className="mz-list-row__text">
            <span className="mz-list-row__title">{t('privacy.neutralNotify')}</span>
            <span className="mz-list-row__sub">{t('privacy.neutralNotify.sub')}</span>
          </span>
          <span className="mz-list-row__end">{t('common.always')}</span>
        </div>
      </div>

      <SectionTitle>{t('privacy.sharing')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow
          icon="hand-heart"
          title={partner?.status === 'paired' ? t('privacy.partner', { name: partner.partnerName }) : t('you.partner')}
          sub={partner?.status === 'paired' ? t('privacy.partnerScopes') : t('you.partner.none')}
          onClick={() => push({ name: 'partner' })}
        />
        {partner?.status === 'paired' && (
          <SwitchRow
            title={t('partner.pause')}
            sub={t('partner.pause.sub', { name: partner.partnerName })}
            checked={partner.paused}
            onChange={(next) => void writePartner({ paused: next })}
          />
        )}
      </div>

      <SectionTitle>{t('privacy.yourData')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow icon="export" title={t('privacy.export')} sub={t('privacy.export.sub')} onClick={() => setExporting(true)} />
        <div className="mz-list-row" style={{ cursor: 'default' }}>
          <Icon name="cloud-slash" size={22} className="mz-list-row__icon" />
          <span className="mz-list-row__text">
            <span className="mz-list-row__title">{t('privacy.backup')}</span>
            <span className="mz-list-row__sub">{t('privacy.backup.sub')}</span>
          </span>
        </div>
        <ListRow icon="trash" title={t('privacy.delete')} sub={t('privacy.delete.sub')} danger onClick={() => setDeleting(true)} />
      </div>

      <div className="mz-section mz-card mz-card--raised">
        <p className="mz-body-sm mz-muted">{t('privacy.honesty')}</p>
      </div>

      {exporting && <ExportSheet onClose={() => setExporting(false)} />}
      {deleting && <DeleteSheet onClose={() => setDeleting(false)} />}
    </Screen>
  )
}

function ExportSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [mode, setMode] = useState<'plain' | 'locked'>('locked')
  const [pass, setPass] = useState('')
  const [includePregnancy, setIncludePregnancy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function go() {
    setBusy(true)
    setError(null)
    try {
      const options = { includePregnancyHistory: includePregnancy }
      const contents =
        mode === 'locked' ? JSON.stringify(await encryptedExport(pass, options)) : JSON.stringify(await collectExport(options), null, 2)
      await shareOrDownload(`meztli-${mode === 'locked' ? 'locked' : 'export'}-${localToday()}.json`, contents)
      await recordTransfer('export-file', t('privacy.ledger.file'), contents.length)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      title={t('privacy.export')}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="mz-btn mz-btn--primary mz-btn--block"
          disabled={busy || (mode === 'locked' && pass.length < 8)}
          onClick={() => void go()}
        >
          {t('privacy.export.go')}
        </button>
      }
    >
      <div className="mz-stack" style={{ gap: 16 }}>
        <div className="mz-list">
          {(['locked', 'plain'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className="mz-list-row" onClick={() => setMode(m)}>
              <span className="mz-list-row__text">
                <span className="mz-list-row__title">{t(`privacy.export.${m}` as MessageKey)}</span>
                <span className="mz-list-row__sub">{t(`privacy.export.${m}.sub` as MessageKey)}</span>
              </span>
              <span className="mz-list-row__end">{mode === m && <Icon name="check" size={20} style={{ color: 'var(--primary-hi)' }} />}</span>
            </button>
          ))}
        </div>
        {mode === 'locked' && (
          <label className="mz-field">
            <span className="mz-field__label">{t('privacy.export.passphrase')}</span>
            <input className="mz-input" type="password" value={pass} onChange={(e) => setPass(e.currentTarget.value)} autoComplete="new-password" />
            <span className="mz-field__help">{t('privacy.export.passHelp')}</span>
          </label>
        )}
        <div className="mz-list">
          <SwitchRow title={t('privacy.export.pregnancy')} sub={t('privacy.export.pregnancy.sub')} checked={includePregnancy} onChange={setIncludePregnancy} />
        </div>
        {error && <p className="mz-field__error">{error}</p>}
      </div>
    </Sheet>
  )
}

function DeleteSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const word = t('privacy.delete.word')
  const ok = text.trim().toUpperCase() === word.toUpperCase()
  return (
    <Sheet
      title={t('privacy.delete')}
      onClose={onClose}
      footer={
        <div className="mz-row">
          <button type="button" className="mz-btn mz-btn--secondary mz-grow" data-autofocus onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="mz-btn mz-btn--danger-solid mz-grow"
            disabled={!ok}
            onClick={async () => {
              void import('../../native/runtime').then((m) => m.destructiveTap())
              await clearSecureSecrets().catch(() => undefined)
              await db.delete()
              try {
                localStorage.clear()
              } catch {
                // nothing stored, or storage blocked
              }
              location.reload()
            }}
          >
            {t('privacy.delete.go')}
          </button>
        </div>
      }
    >
      <div className="mz-stack" style={{ gap: 14 }}>
        <p className="mz-body">{t('privacy.delete.body')}</p>
        <label className="mz-field">
          <span className="mz-field__label">{t('privacy.delete.type', { word })}</span>
          <input className="mz-input" value={text} onChange={(e) => setText(e.currentTarget.value)} autoCapitalize="characters" autoComplete="off" />
        </label>
      </div>
    </Sheet>
  )
}
