/**
 * Terms of Use and Privacy Policy: a reader, a checkbox for onboarding, and a
 * gate that asks again when LEGAL_VERSION changes. Shared by both roles.
 */
import { useState } from 'react'
import { setSetting } from '../db/schema'
import { LEGAL_SETTING, LEGAL_VERSION, legalText, type LegalDoc } from '../content/legal'
import { useT } from '../i18n'
import { Screen } from '../ui/kit'

export async function recordLegalAcceptance(): Promise<void> {
  await setSetting(LEGAL_SETTING, JSON.stringify({ version: LEGAL_VERSION, at: new Date().toISOString() }))
}

export function acceptedVersion(raw: string | undefined): string | null {
  try {
    return raw ? (JSON.parse(raw) as { version?: string }).version ?? null : null
  } catch {
    return null
  }
}

export function LegalReader({ doc, onBack }: { doc: LegalDoc; onBack: () => void }) {
  const t = useT()
  const text = legalText(doc, t.locale)
  return (
    <Screen title={text.title} onBack={onBack}>
      <article className="mz-section mz-stack" style={{ gap: 14 }}>
        <p className="mz-caption">{text.updated}</p>
        <div className="mz-card mz-card--raised mz-stack" style={{ gap: 8 }}>
          <div className="mz-label">{t('legal.short')}</div>
          {text.summary.map((p) => (
            <p key={p} className="mz-body-sm">{p}</p>
          ))}
        </div>
        {text.sections.map((sec) => (
          <section key={sec.heading} className="mz-stack" style={{ gap: 8 }}>
            <h2 className="mz-title">{sec.heading}</h2>
            {sec.body.map((p) => (
              <p key={p} className="mz-body-sm mz-muted" style={{ lineHeight: 1.6 }}>{p}</p>
            ))}
          </section>
        ))}
      </article>
    </Screen>
  )
}

/** "I agree to the Terms of Use and Privacy Policy", with both readable in place. */
export function LegalCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const t = useT()
  const [reading, setReading] = useState<LegalDoc | null>(null)
  return (
    <>
      <div className="mz-card mz-card--sm mz-stack" style={{ gap: 10 }}>
        <label className="mz-row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} style={{ width: 22, height: 22, accentColor: 'var(--primary)', flex: 'none' }} />
          <span className="mz-body-sm">{t('legal.agree')}</span>
        </label>
        <div className="mz-row" style={{ gap: 16, paddingLeft: 34 }}>
          <button type="button" className="mz-link" onClick={() => setReading('terms')}>{t('legal.readTerms')}</button>
          <button type="button" className="mz-link" onClick={() => setReading('privacy')}>{t('legal.readPrivacy')}</button>
        </div>
      </div>
      {reading && <LegalReader doc={reading} onBack={() => setReading(null)} />}
    </>
  )
}

/** Shown instead of the app when the accepted version is older than the current one. */
export function LegalUpdateGate({ onAccepted }: { onAccepted: () => void }) {
  const t = useT()
  const [agree, setAgree] = useState(false)
  return (
    <div className="mz-app">
      <main className="mz-main">
        <div className="mz-page mz-page--flush-bottom" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="mz-hero" style={{ paddingTop: 48 }}>
            <h1 className="mz-title-lg">{t('legal.updated.title')}</h1>
            <p className="mz-body mz-muted" style={{ marginTop: 6 }}>{t('legal.updated.body')}</p>
          </div>
          <div className="mz-section mz-grow">
            <LegalCheckbox checked={agree} onChange={setAgree} />
          </div>
          <div className="mz-section">
            <button
              type="button"
              className="mz-btn mz-btn--primary mz-btn--block"
              disabled={!agree}
              onClick={async () => {
                await recordLegalAcceptance()
                onAccepted()
              }}
            >
              {t('common.continue')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
