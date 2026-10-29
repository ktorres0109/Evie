/**
 * Pregnancy and pregnancy endings (decisions C1–C6).
 *
 * - Starting a pregnancy pauses cycle estimates and shows the week.
 * - "Pregnancy ended" is one neutral entry. Keeping how it ended is opt-in and
 *   off by default: data that does not exist cannot be seized or leaked.
 * - After it ends: warning signs (ACOG/NICHD), verified support lines, and
 *   room for the person's own contacts. Never shared with a partner, and left
 *   out of exports unless chosen each time.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { AFTERCARE_SOURCES, CARE_RESOURCES, RESOURCES_LAST_CHECKED } from '../../content/careResources'
import { db, getSetting, putHealthProfile, setSetting, type LifeEvent, type PregnancyOutcome } from '../../db/schema'
import { addDays } from '../../engine/cycle'
import { pregnancyTimeline, resolvePregnancyDating, type PregnancyDatingMethod } from '../../engine/pregnancyDating'
import { useT, type MessageKey } from '../../i18n'
import { dayMonth } from '../../i18n/dates'
import { useNav } from '../../state/nav'
import type { CycleData } from '../../state/useCycle'
import { Icon } from '../../ui/icons'
import { Banner, ListRow, Screen, SectionTitle, Sheet, SwitchRow } from '../../ui/kit'
import { PregnancyDetailScreen } from '../PregnancyDetailScreen'

const OUTCOMES: PregnancyOutcome[] = ['birth', 'miscarriage', 'abortion', 'ectopic', 'other', 'prefer-not-to-say']

export function PregnancyScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop } = useNav()
  const [sheet, setSheet] = useState<'start' | 'end' | 'week' | null>(null)
  const active = data.lifeEvents.find((e) => e.kind === 'pregnancy' && !e.endDate)
  const pregnantByGoal = data.profile.primaryGoal === 'pregnancy'
  const pregnant = Boolean(active) || pregnantByGoal
  const ended = data.lifeEvents.filter((e) => e.kind === 'pregnancy-ended').sort((a, b) => b.startDate.localeCompare(a.startDate))
  const recentEnd = ended.find((e) => e.startDate >= addDays(data.today, -42))
  const dating = data.profile.reproductive.pregnancyDating
  const resolved = dating
    ? resolvePregnancyDating({ method: dating.method, date: dating.inputDate, clinicianConfirmed: dating.authority === 'clinician-assigned' })
    : null
  const timeline = resolved ? pregnancyTimeline(resolved, data.today) : null

  if (sheet === 'week' && resolved) return <PregnancyDetailScreen dating={resolved} onBack={() => setSheet(null)} />

  return (
    <Screen title={t('preg.title')} onBack={pop}>
      {pregnant ? (
        <section className="mz-section mz-card mz-stack" style={{ gap: 10 }}>
          <div className="mz-caption">{t('preg.current')}</div>
          <div className="mz-title-lg">
            {timeline ? t('today.hero.pregnancyWeek', { n: timeline.week }) : t('preg.datingUnknown')}
          </div>
          {timeline && (
            <p className="mz-body-sm mz-muted">
              {t('preg.due', { date: dayMonth(timeline.estimatedDueDate, t.locale) })}
              {resolved?.provisional ? ` · ${t('preg.provisional')}` : ''}
            </p>
          )}
          <p className="mz-body-sm mz-muted">{t('preg.paused')}</p>
          <div className="mz-row" style={{ marginTop: 6 }}>
            {resolved && (
              <button type="button" className="mz-btn mz-btn--secondary mz-grow" onClick={() => setSheet('week')}>
                {t('preg.weekByWeek')}
              </button>
            )}
            <button type="button" className="mz-btn mz-btn--secondary mz-grow" onClick={() => setSheet('start')}>
              {t('preg.updateDating')}
            </button>
          </div>
          <button type="button" className="mz-btn mz-btn--ghost" onClick={() => setSheet('end')}>
            {t('preg.ended')}
          </button>
        </section>
      ) : (
        <section className="mz-section mz-card mz-stack">
          <div className="mz-title">{t('preg.notTitle')}</div>
          <p className="mz-body-sm mz-muted">{t('preg.notBody')}</p>
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => setSheet('start')}>
            {t('preg.start')}
          </button>
          <button type="button" className="mz-btn mz-btn--ghost" onClick={() => setSheet('end')}>
            {t('preg.recordPast')}
          </button>
        </section>
      )}

      {recentEnd && <Aftercare />}

      {ended.length > 0 && (
        <>
          <SectionTitle>{t('preg.history')}</SectionTitle>
          <div className="mz-section mz-list">
            {ended.map((e) => (
              <EndedRow key={e.id} event={e} />
            ))}
          </div>
          <p className="mz-caption mz-gutter">{t('preg.historyPrivate')}</p>
        </>
      )}

      {!recentEnd && (
        <>
          <SectionTitle>{t('preg.support')}</SectionTitle>
          <Resources />
        </>
      )}

      {sheet === 'start' && <StartSheet data={data} onDone={() => setSheet(null)} />}
      {sheet === 'end' && <EndSheet data={data} active={active} onDone={() => setSheet(null)} />}
    </Screen>
  )
}

function StartSheet({ data, onDone }: { data: CycleData; onDone: () => void }) {
  const t = useT()
  const existing = data.profile.reproductive.pregnancyDating
  const [method, setMethod] = useState<PregnancyDatingMethod>(existing?.method ?? 'lmp')
  const [date, setDate] = useState(existing?.inputDate ?? data.state.lastPeriodStart ?? data.today)
  const [confirmed, setConfirmed] = useState(existing?.authority === 'clinician-assigned')

  async function save() {
    const r = resolvePregnancyDating({ method, date, clinicianConfirmed: confirmed })
    const now = new Date().toISOString()
    await putHealthProfile({
      primaryGoal: 'pregnancy',
      reproductive: {
        pregnancyLmp: method === 'lmp' ? date : undefined,
        pregnancyDating: {
          method,
          inputDate: date,
          estimatedDueDate: r.estimatedDueDate,
          gestationalStart: r.gestationalStart,
          authority: r.authority,
          provisional: r.provisional,
          updatedAt: now,
        },
      },
    })
    const open = await db.lifeEvents.filter((e) => e.kind === 'pregnancy' && !e.endDate).first()
    await db.lifeEvents.put({
      id: open?.id ?? `pregnancy-${r.gestationalStart}`,
      kind: 'pregnancy',
      startDate: r.gestationalStart,
      createdAt: open?.createdAt ?? now,
    })
    onDone()
  }

  return (
    <Sheet
      title={t('preg.start')}
      onClose={onDone}
      footer={
        <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => void save()}>
          {t('common.save')}
        </button>
      }
    >
      <div className="mz-stack" style={{ gap: 16 }}>
        <div className="mz-field">
          <span className="mz-field__label">{t('preg.datingFrom')}</span>
          <div className="mz-list">
            {(['lmp', 'clinician-edd', 'conception', 'ivf-day-3', 'ivf-day-5'] as PregnancyDatingMethod[]).map((m) => (
              <button key={m} type="button" className="mz-list-row" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}>
                <span className="mz-list-row__text">
                  <span className="mz-list-row__title">{t(`preg.method.${m}` as MessageKey)}</span>
                </span>
                <span className="mz-list-row__end">{method === m && <Icon name="check" size={20} style={{ color: 'var(--primary-hi)' }} />}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="mz-field">
          <span className="mz-field__label">{t(method === 'clinician-edd' ? 'preg.dueDate' : 'preg.date')}</span>
          <input
            className="mz-input"
            type="date"
            value={date}
            max={method === 'clinician-edd' ? undefined : data.today}
            onChange={(e) => setDate(e.currentTarget.value)}
          />
        </label>
        {method !== 'clinician-edd' && (
          <div className="mz-list">
            <SwitchRow title={t('preg.confirmed')} sub={t('preg.confirmedSub')} checked={confirmed} onChange={setConfirmed} />
          </div>
        )}
        <p className="mz-caption">{t('preg.startNote')}</p>
      </div>
    </Sheet>
  )
}

function EndSheet({ data, active, onDone }: { data: CycleData; active?: LifeEvent; onDone: () => void }) {
  const t = useT()
  const [date, setDate] = useState(data.today)
  const [keep, setKeep] = useState(false)
  const [outcome, setOutcome] = useState<PregnancyOutcome | undefined>(undefined)
  const [feeding, setFeeding] = useState(false)

  async function save() {
    const now = new Date().toISOString()
    await db.transaction('rw', db.lifeEvents, db.healthProfiles, async () => {
      if (active) await db.lifeEvents.put({ ...active, endDate: date })
      await db.lifeEvents.put({
        id: `pregnancy-ended-${date}-${Date.now().toString(36)}`,
        kind: 'pregnancy-ended',
        startDate: date,
        outcome: keep ? outcome : undefined,
        createdAt: now,
      })
      if (keep && outcome === 'birth' && feeding) {
        await db.lifeEvents.put({ id: `breastfeeding-${date}`, kind: 'breastfeeding', startDate: date, createdAt: now })
      }
    })
    if (data.profile.primaryGoal === 'pregnancy') await putHealthProfile({ primaryGoal: 'cycle', goals: ['cycle'] })
    onDone()
  }

  return (
    <Sheet
      title={t('preg.ended')}
      onClose={onDone}
      footer={
        <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => void save()} disabled={keep && !outcome}>
          {t('common.save')}
        </button>
      }
    >
      <div className="mz-stack" style={{ gap: 16 }}>
        <p className="mz-body-sm mz-muted">{t('preg.end.intro')}</p>
        <label className="mz-field">
          <span className="mz-field__label">{t('preg.end.date')}</span>
          <input className="mz-input" type="date" value={date} max={data.today} onChange={(e) => setDate(e.currentTarget.value)} />
        </label>
        <div className="mz-list">
          <SwitchRow title={t('preg.end.keep')} sub={t('preg.end.keepSub')} checked={keep} onChange={setKeep} />
        </div>
        {keep && (
          <div className="mz-field">
            <span className="mz-field__label">{t('preg.end.how')}</span>
            <div className="mz-chips" role="radiogroup">
              {OUTCOMES.map((o) => (
                <button key={o} type="button" role="radio" aria-checked={outcome === o} className="mz-chip" onClick={() => setOutcome(o)}>
                  {outcome === o && <span aria-hidden="true">✓</span>}
                  {t(`preg.outcome.${o}` as MessageKey)}
                </button>
              ))}
            </div>
          </div>
        )}
        {keep && outcome === 'birth' && (
          <div className="mz-list">
            <SwitchRow title={t('preg.end.feeding')} sub={t('preg.end.feedingSub')} checked={feeding} onChange={setFeeding} />
          </div>
        )}
        <p className="mz-caption">{t('preg.end.privacy')}</p>
      </div>
    </Sheet>
  )
}

function EndedRow({ event }: { event: LifeEvent }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <ListRow
        title={t('preg.endedOn', { date: dayMonth(event.startDate, t.locale) })}
        sub={event.outcome ? t(`preg.outcome.${event.outcome}` as MessageKey) : t('preg.noDetail')}
        onClick={() => setOpen(true)}
      />
      {open && (
        <Sheet title={t('preg.endedOn', { date: dayMonth(event.startDate, t.locale) })} onClose={() => setOpen(false)}>
          <div className="mz-stack" style={{ gap: 12 }}>
            {event.outcome && (
              <button
                type="button"
                className="mz-btn mz-btn--secondary mz-btn--block"
                onClick={async () => {
                  await db.lifeEvents.put({ ...event, outcome: undefined })
                  setOpen(false)
                }}
              >
                {t('preg.removeDetail')}
              </button>
            )}
            {!confirm ? (
              <button type="button" className="mz-btn mz-btn--danger mz-btn--block" onClick={() => setConfirm(true)}>
                {t('preg.deleteRecord')}
              </button>
            ) : (
              <div className="mz-card mz-card--sm mz-card--raised mz-stack">
                <p className="mz-body-sm">{t('preg.deleteConfirm')}</p>
                <div className="mz-row">
                  <button type="button" className="mz-btn mz-btn--secondary mz-grow" data-autofocus onClick={() => setConfirm(false)}>
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="mz-btn mz-btn--danger mz-grow"
                    onClick={async () => {
                      await db.lifeEvents.delete(event.id)
                      setOpen(false)
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            )}
            <p className="mz-caption">{t('preg.deleteNote')}</p>
          </div>
        </Sheet>
      )}
    </>
  )
}

function Aftercare() {
  const t = useT()
  return (
    <>
      <SectionTitle>{t('aftercare.title')}</SectionTitle>
      <div className="mz-section">
        <Banner tone="critical" icon="warning-octagon:fill" title={t('aftercare.now')}>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {(['bleeding', 'fever', 'pain', 'discharge', 'faint'] as const).map((k) => (
              <li key={k} style={{ marginBottom: 4 }}>{t(`aftercare.${k}`)}</li>
            ))}
          </ul>
        </Banner>
      </div>
      <p className="mz-caption mz-gutter" style={{ marginBottom: 12 }}>
        {t('aftercare.source')} <a href={AFTERCARE_SOURCES[0]} target="_blank" rel="noreferrer" className="mz-accent">ACOG</a> ·{' '}
        <a href={AFTERCARE_SOURCES[1]} target="_blank" rel="noreferrer" className="mz-accent">NICHD</a>
      </p>
      <div className="mz-section mz-card">
        <p className="mz-body-sm">{t('aftercare.feelings')}</p>
      </div>
      <SectionTitle>{t('preg.support')}</SectionTitle>
      <Resources />
    </>
  )
}

export function Resources() {
  const t = useT()
  const custom = useLiveQuery(async () => {
    const raw = await getSetting('care.custom.v1')
    try {
      return raw ? (JSON.parse(raw) as { name: string; phone: string }[]) : []
    } catch {
      return []
    }
  }, [])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <>
      <div className="mz-section mz-list">
        {CARE_RESOURCES.map((r) => (
          <a key={r.id} className="mz-list-row" href={`tel:${r.tel}`} style={{ textDecoration: 'none' }}>
            <Icon name="first-aid" size={22} className="mz-list-row__icon" />
            <span className="mz-list-row__text">
              <span className="mz-list-row__title">{r.name}</span>
              <span className="mz-list-row__sub">
                {t(`resource.${r.about}` as MessageKey)}
                {r.spanish ? ` · ${t('resource.spanish')}` : ''}
              </span>
            </span>
            <span className="mz-list-row__end">{r.phone}</span>
          </a>
        ))}
        {(custom ?? []).map((c, i) => (
          <a key={i} className="mz-list-row" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} style={{ textDecoration: 'none' }}>
            <Icon name="user" size={22} className="mz-list-row__icon" />
            <span className="mz-list-row__text">
              <span className="mz-list-row__title">{c.name}</span>
              <span className="mz-list-row__sub">{t('resource.yours')}</span>
            </span>
            <span className="mz-list-row__end">{c.phone}</span>
          </a>
        ))}
        <ListRow icon="plus-circle" title={t('resource.add')} onClick={() => setAdding(true)} />
      </div>
      <p className="mz-caption mz-gutter">{t('resource.checked', { date: dayMonth(RESOURCES_LAST_CHECKED, t.locale) })}</p>
      {adding && (
        <Sheet
          title={t('resource.add')}
          onClose={() => setAdding(false)}
          footer={
            <button
              type="button"
              className="mz-btn mz-btn--primary mz-btn--block"
              disabled={!name.trim() || !phone.trim()}
              onClick={async () => {
                await setSetting('care.custom.v1', JSON.stringify([...(custom ?? []), { name: name.trim(), phone: phone.trim() }]))
                setAdding(false)
                setName('')
                setPhone('')
              }}
            >
              {t('common.save')}
            </button>
          }
        >
          <div className="mz-stack" style={{ gap: 12 }}>
            <label className="mz-field">
              <span className="mz-field__label">{t('resource.name')}</span>
              <input className="mz-input" value={name} onChange={(e) => setName(e.currentTarget.value)} />
            </label>
            <label className="mz-field">
              <span className="mz-field__label">{t('resource.phone')}</span>
              <input className="mz-input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
            </label>
          </div>
        </Sheet>
      )}
    </>
  )
}
