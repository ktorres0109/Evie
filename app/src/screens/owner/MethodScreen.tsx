/**
 * Birth control (decisions B1–B4): record any method, set up its schedule,
 * see the expected withdrawal bleed with comfort ideas, log a missed pill,
 * stop or switch. Records are dated and never deleted, so past cycles keep
 * their correct interpretation.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, putHealthProfile, type ContraceptionMethod } from '../../db/schema'
import { activeRegimenOn, regimenId, type MethodConfig, type RegimenRecord, type TrackableMethod } from '../../db/regimen'
import { addDays, daysBetween } from '../../engine/cycle'
import { isHormonalMethod, withdrawalBleedFor } from '../../engine/estimate'
import { useT, type MessageKey, type Translator } from '../../i18n'
import { dateRange, dayMonth } from '../../i18n/dates'
import { useNav } from '../../state/nav'
import type { CycleData } from '../../state/useCycle'
import { Icon } from '../../ui/icons'
import { Banner, ListRow, Screen, SectionTitle, Segment, Sheet } from '../../ui/kit'
import { scheduleAllReminders } from '../../native/schedule'

export type MethodChoice =
  | 'pill-combined'
  | 'pill-progestin'
  | 'patch'
  | 'ring'
  | 'injection'
  | 'implant'
  | 'iud-hormonal'
  | 'iud-copper'
  | 'barrier'
  | 'withdrawal'
  | 'fertility-awareness'
  | 'partner-vasectomy'
  | 'other'

const CHOICES: MethodChoice[] = [
  'pill-combined',
  'pill-progestin',
  'patch',
  'ring',
  'injection',
  'implant',
  'iud-hormonal',
  'iud-copper',
  'barrier',
  'withdrawal',
  'fertility-awareness',
  'partner-vasectomy',
  'other',
]

const CHOICE_METHOD: Record<MethodChoice, TrackableMethod> = {
  'pill-combined': 'combined-pill-patch-ring',
  'pill-progestin': 'progestin-only-pill',
  patch: 'combined-pill-patch-ring',
  ring: 'combined-pill-patch-ring',
  injection: 'injection',
  implant: 'implant',
  'iud-hormonal': 'hormonal-iud',
  'iud-copper': 'copper-iud',
  barrier: 'barrier',
  withdrawal: 'withdrawal',
  'fertility-awareness': 'fertility-awareness',
  'partner-vasectomy': 'partner-vasectomy',
  other: 'other',
}

export function choiceOf(record: RegimenRecord): MethodChoice {
  const c = record.config
  if (c?.kind === 'patch') return 'patch'
  if (c?.kind === 'ring') return 'ring'
  if (c?.kind === 'iud') return c.hormonal ? 'iud-hormonal' : 'iud-copper'
  if (record.method === 'progestin-only-pill') return 'pill-progestin'
  if (record.method === 'combined-pill-patch-ring') return 'pill-combined'
  if (record.method === 'hormonal-iud') return 'iud-hormonal'
  if (record.method === 'copper-iud') return 'iud-copper'
  return (CHOICES.find((c) => CHOICE_METHOD[c] === record.method) ?? 'other') as MethodChoice
}

export function regimenLabel(record: RegimenRecord, t: Translator): string {
  return t(`choice.${choiceOf(record)}` as MessageKey)
}

function effectiveMethod(record: RegimenRecord): ContraceptionMethod {
  const c = record.config
  if (c?.kind === 'iud') return c.hormonal ? 'hormonal-iud' : 'copper-iud'
  return record.method
}

type PillPack = '21-7' | '24-4' | '28-0' | '84-7'

/** Next scheduled action for the active method, in words. */
function nextAction(record: RegimenRecord, today: string, t: Translator): string | null {
  const c = record.config
  if (!c) return null
  if (c.kind === 'pill' && c.currentPackStart) {
    const len = c.activePillsPerPack + c.placeboPillsPerPack
    const day = (((daysBetween(c.currentPackStart, today) % len) + len) % len) + 1
    return t('method.packDay', { n: day, total: len })
  }
  if ((c.kind === 'patch' || c.kind === 'ring') && (c.kind === 'patch' ? c.currentPatchStart : c.currentRingStart)) {
    const start = (c.kind === 'patch' ? c.currentPatchStart : c.currentRingStart)!
    const len = c.cycle.wearDays + c.cycle.ringFreeDays
    const into = ((daysBetween(start, today) % len) + len) % len
    if (c.kind === 'patch') {
      // Three weekly patches, then a patch-free week.
      if (into >= c.cycle.wearDays) return t('method.patchOn', { date: dayMonth(addDays(today, len - into), t.locale) })
      if (into > 0 && into % 7 === 0) return t('method.patchChangeToday')
      const next = into + (7 - (into % 7))
      return next >= c.cycle.wearDays
        ? t('method.patchFree', { date: dayMonth(addDays(today, next - into), t.locale) })
        : t('method.patchChange', { date: dayMonth(addDays(today, next - into), t.locale) })
    }
    if (into < c.cycle.wearDays) return t('method.ringOut', { date: dayMonth(addDays(today, c.cycle.wearDays - into), t.locale) })
    return t('method.ringIn', { date: dayMonth(addDays(today, len - into), t.locale) })
  }
  if (c.kind === 'injection' && c.lastInjectionDate) {
    return t('method.shotDue', { date: dayMonth(addDays(c.lastInjectionDate, c.intervalDays), t.locale) })
  }
  if ((c.kind === 'implant' || c.kind === 'iud') && (c.kind === 'implant' ? c.plannedRemovalDate : c.plannedReplacementDate)) {
    return t('method.replaceBy', { date: dayMonth((c.kind === 'implant' ? c.plannedRemovalDate : c.plannedReplacementDate)!, t.locale) })
  }
  return null
}

export function MethodScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop, push } = useNav()
  const [editing, setEditing] = useState<MethodChoice | 'pick' | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const active = activeRegimenOn(data.regimens, data.today)
  const history = [...data.regimens].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const withdrawal = withdrawalBleedFor(data.regimens, data.today)
  const missedThisPack = useLiveQuery(async () => {
    if (!active) return 0
    const since = addDays(data.today, -28)
    return db.missedDoseEvents.where('regimenId').equals(active.id).filter((e) => e.date >= since).count()
  }, [active?.id, data.today])

  async function stop() {
    if (!active) return
    await db.regimenRecords.put({ ...active, endDate: data.today, updatedAt: new Date().toISOString() })
    await putHealthProfile({ reproductive: { contraception: 'none' } })
    void scheduleAllReminders()
    setConfirmStop(false)
  }

  return (
    <Screen title={t('method.title')} onBack={pop}>
      {active ? (
        <section className="mz-section mz-card mz-stack" style={{ gap: 10 }}>
          <div className="mz-caption">{t('method.current')}</div>
          <div className="mz-title-lg">{regimenLabel(active, t)}</div>
          <p className="mz-body-sm mz-muted">{t('method.since', { date: dayMonth(active.startDate, t.locale) })}</p>
          {nextAction(active, data.today, t) && <p className="mz-body">{nextAction(active, data.today, t)}</p>}
          <p className="mz-body-sm mz-muted">
            {isHormonalMethod(effectiveMethod(active)) ? t('method.effect.hormonal') : t('method.effect.none')}
          </p>
          <div className="mz-row" style={{ marginTop: 6 }}>
            <button type="button" className="mz-btn mz-btn--secondary mz-grow" style={{ padding: '0 12px', fontSize: 15 }} onClick={() => setEditing(choiceOf(active))}>
              {t('method.edit')}
            </button>
            <button type="button" className="mz-btn mz-btn--secondary mz-grow" style={{ padding: '0 12px', fontSize: 15 }} onClick={() => setEditing('pick')}>
              {t('method.switch')}
            </button>
          </div>
          {!confirmStop ? (
            <button type="button" className="mz-btn mz-btn--ghost" onClick={() => setConfirmStop(true)}>
              {t('method.stop')}
            </button>
          ) : (
            <div className="mz-card mz-card--sm mz-card--raised mz-stack">
              <p className="mz-body-sm">
                {isHormonalMethod(effectiveMethod(active)) ? t('method.stopConfirmHormonal') : t('method.stopConfirm')}
              </p>
              <div className="mz-row">
                <button type="button" className="mz-btn mz-btn--secondary mz-grow" data-autofocus onClick={() => setConfirmStop(false)}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="mz-btn mz-btn--primary mz-grow" onClick={() => void stop()}>
                  {t('method.stopToday')}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="mz-section mz-card mz-stack">
          <div className="mz-title">{t('method.noneTitle')}</div>
          <p className="mz-body-sm mz-muted">{t('method.noneBody')}</p>
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => setEditing('pick')}>
            {t('method.add')}
          </button>
        </section>
      )}

      {withdrawal && (
        <>
          <SectionTitle>{t('method.withdrawalBleed')}</SectionTitle>
          <section className="mz-section mz-card mz-stack" style={{ gap: 8 }}>
            <div className="mz-title">{dateRange(withdrawal.expected.start, withdrawal.expected.end, t.locale)}</div>
            <p className="mz-body-sm mz-muted">{t(`today.card.withdrawalNote.${withdrawal.method}` as MessageKey)}</p>
          </section>
          <ComfortCard />
        </>
      )}

      {active && (active.config?.kind === 'pill' || active.method === 'progestin-only-pill') && (
        <>
          <SectionTitle>{t('method.missed')}</SectionTitle>
          <section className="mz-section mz-card mz-stack" style={{ gap: 8 }}>
            <p className="mz-body-sm">{missedThisPack ? t.n('method.missedCount', missedThisPack) : t('method.missedNone')}</p>
            <p className="mz-body-sm mz-muted">{t('method.missedAdvice')}</p>
          </section>
        </>
      )}

      <SectionTitle>{t('method.reminders')}</SectionTitle>
      <div className="mz-section mz-list">
        <ListRow icon="bell" title={t('method.reminders.row')} sub={t('method.reminders.sub')} onClick={() => push({ name: 'notifications' })} />
      </div>

      {history.length > 0 && (
        <>
          <SectionTitle>{t('method.history')}</SectionTitle>
          <div className="mz-section mz-list">
            {history.map((r) => (
              <div key={r.id} className="mz-list-row" style={{ cursor: 'default' }}>
                <span className="mz-list-row__text">
                  <span className="mz-list-row__title">{regimenLabel(r, t)}</span>
                  <span className="mz-list-row__sub">
                    {r.endDate ? dateRange(r.startDate, r.endDate, t.locale, true) : t('method.since', { date: dayMonth(r.startDate, t.locale) })}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mz-caption mz-gutter" style={{ marginTop: 12 }}>{t('method.footer')}</p>

      {editing === 'pick' && (
        <Sheet title={t('method.pick')} onClose={() => setEditing(null)}>
          <div className="mz-list">
            {CHOICES.map((c) => (
              <ListRow key={c} title={t(`choice.${c}` as MessageKey)} sub={t(`choice.${c}.sub` as MessageKey)} onClick={() => setEditing(c)} />
            ))}
          </div>
        </Sheet>
      )}
      {editing && editing !== 'pick' && (
        <MethodSetup choice={editing} data={data} existing={active && choiceOf(active) === editing ? active : undefined} onDone={() => setEditing(null)} />
      )}
    </Screen>
  )
}

function ComfortCard() {
  const t = useT()
  return (
    <section className="mz-section mz-card mz-stack" style={{ gap: 10 }}>
      <div className="mz-label">{t('comfort.title')}</div>
      {(['heat', 'move', 'pain', 'water', 'rest'] as const).map((k) => (
        <div key={k} className="mz-row" style={{ alignItems: 'flex-start' }}>
          <Icon name="leaf" size={18} style={{ color: 'var(--care)', marginTop: 2, flex: 'none' }} />
          <p className="mz-body-sm">{t(`comfort.${k}`)}</p>
        </div>
      ))}
      <p className="mz-caption">{t('comfort.when')}</p>
    </section>
  )
}

function MethodSetup({
  choice,
  data,
  existing,
  onDone,
}: {
  choice: MethodChoice
  data: CycleData
  existing?: RegimenRecord
  onDone: () => void
}) {
  const t = useT()
  const today = data.today
  const c = existing?.config
  const [start, setStart] = useState(existing?.startDate ?? today)
  const [pack, setPack] = useState<PillPack>(() => {
    if (c?.kind !== 'pill') return '21-7'
    if (c.schedule === 'continuous') return '28-0'
    if (c.activePillsPerPack === 84) return '84-7'
    if (c.activePillsPerPack === 24) return '24-4'
    return '21-7'
  })
  const [anchor, setAnchor] = useState(
    c?.kind === 'pill'
      ? (c.currentPackStart ?? today)
      : c?.kind === 'patch'
        ? (c.currentPatchStart ?? today)
        : c?.kind === 'ring'
          ? (c.currentRingStart ?? today)
          : c?.kind === 'injection'
            ? (c.lastInjectionDate ?? today)
            : c?.kind === 'implant' || c?.kind === 'iud'
              ? (c.insertedDate ?? today)
              : today,
  )
  const [replaceBy, setReplaceBy] = useState(
    c?.kind === 'implant' ? (c.plannedRemovalDate ?? '') : c?.kind === 'iud' ? (c.plannedReplacementDate ?? '') : '',
  )
  const [interval, setInterval] = useState(c?.kind === 'injection' ? c.intervalDays : 91)
  const [product, setProduct] = useState(existing?.product ?? '')

  function config(): MethodConfig | undefined {
    switch (choice) {
      case 'pill-combined': {
        const [a, p] = pack.split('-').map(Number)
        return {
          kind: 'pill',
          activePillsPerPack: a,
          placeboPillsPerPack: p,
          schedule: pack === '28-0' ? 'continuous' : pack === '84-7' ? 'extended' : 'standard',
          currentPackStart: anchor,
        }
      }
      case 'pill-progestin':
        return { kind: 'pill', activePillsPerPack: 28, placeboPillsPerPack: 0, schedule: 'continuous', currentPackStart: anchor }
      case 'patch':
        return { kind: 'patch', cycle: { wearDays: 21, ringFreeDays: 7 }, currentPatchStart: anchor }
      case 'ring':
        return { kind: 'ring', cycle: { wearDays: 21, ringFreeDays: 7 }, currentRingStart: anchor }
      case 'injection':
        return { kind: 'injection', intervalDays: interval, lastInjectionDate: anchor }
      case 'implant':
        return { kind: 'implant', insertedDate: anchor, plannedRemovalDate: replaceBy || undefined }
      case 'iud-hormonal':
      case 'iud-copper':
        return { kind: 'iud', hormonal: choice === 'iud-hormonal', insertedDate: anchor, plannedReplacementDate: replaceBy || undefined }
      default:
        return undefined
    }
  }

  async function save() {
    const now = new Date().toISOString()
    const method = CHOICE_METHOD[choice]
    await db.transaction('rw', db.regimenRecords, async () => {
      if (existing) {
        await db.regimenRecords.put({ ...existing, startDate: start, config: config(), product: product || undefined, updatedAt: now })
        return
      }
      // Switching: close whatever was active the day before the new one starts.
      const current = activeRegimenOn(await db.regimenRecords.toArray(), start)
      if (current) await db.regimenRecords.put({ ...current, endDate: addDays(start, -1), updatedAt: now })
      await db.regimenRecords.put({
        id: regimenId(method, start) + (choice === 'patch' || choice === 'ring' ? `:${choice}` : ''),
        method,
        startDate: start,
        config: config(),
        product: product || undefined,
        createdAt: now,
        updatedAt: now,
      })
    })
    await putHealthProfile({ reproductive: { contraception: method } })
    void scheduleAllReminders()
    onDone()
  }

  const anchorLabel: MessageKey | null =
    choice === 'pill-combined' || choice === 'pill-progestin'
      ? 'method.setup.packStart'
      : choice === 'patch'
        ? 'method.setup.patchStart'
        : choice === 'ring'
          ? 'method.setup.ringStart'
          : choice === 'injection'
            ? 'method.setup.lastShot'
            : choice === 'implant' || choice === 'iud-hormonal' || choice === 'iud-copper'
              ? 'method.setup.inserted'
              : null

  return (
    <Sheet
      title={t(`choice.${choice}` as MessageKey)}
      onClose={onDone}
      footer={
        <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => void save()}>
          {t('common.save')}
        </button>
      }
    >
      <div className="mz-stack" style={{ gap: 16 }}>
        <label className="mz-field">
          <span className="mz-field__label">{t('method.setup.started')}</span>
          <input className="mz-input" type="date" value={start} max={today} onChange={(e) => setStart(e.currentTarget.value)} />
        </label>
        {choice === 'pill-combined' && (
          <div className="mz-field">
            <span className="mz-field__label">{t('method.setup.pack')}</span>
            <Segment
              label={t('method.setup.pack')}
              value={pack}
              onChange={setPack}
              options={[
                { id: '21-7', label: '21/7' },
                { id: '24-4', label: '24/4' },
                { id: '84-7', label: '84/7' },
                { id: '28-0', label: t('method.setup.continuous') },
              ]}
            />
          </div>
        )}
        {anchorLabel && (
          <label className="mz-field">
            <span className="mz-field__label">{t(anchorLabel)}</span>
            <input className="mz-input" type="date" value={anchor} max={today} onChange={(e) => setAnchor(e.currentTarget.value)} />
          </label>
        )}
        {choice === 'injection' && (
          <label className="mz-field">
            <span className="mz-field__label">{t('method.setup.interval')}</span>
            <input
              className="mz-input"
              type="number"
              inputMode="numeric"
              min={28}
              max={120}
              value={interval}
              onChange={(e) => setInterval(Number(e.currentTarget.value) || 91)}
            />
          </label>
        )}
        {(choice === 'implant' || choice === 'iud-hormonal' || choice === 'iud-copper') && (
          <label className="mz-field">
            <span className="mz-field__label">{t('method.setup.replaceBy')}</span>
            <input className="mz-input" type="date" value={replaceBy} min={anchor} onChange={(e) => setReplaceBy(e.currentTarget.value)} />
            <span className="mz-field__help">{t('method.setup.replaceHelp')}</span>
          </label>
        )}
        <label className="mz-field">
          <span className="mz-field__label">{t('method.setup.product')}</span>
          <input className="mz-input" value={product} onChange={(e) => setProduct(e.currentTarget.value)} placeholder={t('method.setup.productHint')} />
        </label>
        {isHormonalMethod(CHOICE_METHOD[choice] === 'combined-pill-patch-ring' ? 'combined-pill-patch-ring' : choice === 'iud-hormonal' ? 'hormonal-iud' : CHOICE_METHOD[choice]) && (
          <Banner tone="info" icon="info">{t('method.setup.hormonalNote')}</Banner>
        )}
      </div>
    </Sheet>
  )
}
