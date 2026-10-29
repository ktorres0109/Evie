/**
 * Life context (decisions D1–D2). Self-reported, dated entries for anything
 * that can change a cycle. Each kind states its effect on estimates in plain
 * words: withhold, widen, or leave that cycle out. The app never suggests a
 * condition.
 */
import { useState } from 'react'
import { db, type LifeEvent, type LifeEventKind } from '../../db/schema'
import { useT, type MessageKey } from '../../i18n'
import { dateRange, dayMonth } from '../../i18n/dates'
import { useNav } from '../../state/nav'
import type { CycleData } from '../../state/useCycle'
import { ListRow, Screen, SectionTitle, Sheet, SwitchRow } from '../../ui/kit'
import { lifeKindName } from './estimateText'

type Effect = 'withhold' | 'widen' | 'exclude' | 'note'

export const LIFE_EFFECT: Record<LifeEventKind, Effect> = {
  pregnancy: 'withhold',
  'pregnancy-ended': 'widen',
  postpartum: 'withhold',
  breastfeeding: 'withhold',
  'emergency-contraception': 'widen',
  'stopped-hormonal': 'widen',
  pcos: 'widen',
  endometriosis: 'widen',
  thyroid: 'widen',
  perimenopause: 'widen',
  menopause: 'withhold',
  illness: 'exclude',
  stress: 'exclude',
  travel: 'exclude',
  'weight-change': 'widen',
  'intense-training': 'widen',
  testosterone: 'withhold',
  hysterectomy: 'withhold',
  ablation: 'note',
  medication: 'note',
}

/** One-day events have no "ongoing" state. */
const POINT_EVENTS = new Set<LifeEventKind>(['emergency-contraception', 'stopped-hormonal', 'pregnancy-ended', 'hysterectomy', 'ablation'])

const GROUPS: { title: MessageKey; kinds: LifeEventKind[] }[] = [
  { title: 'life.group.cycle', kinds: ['illness', 'stress', 'travel', 'weight-change', 'intense-training'] },
  { title: 'life.group.method', kinds: ['emergency-contraception', 'stopped-hormonal', 'medication'] },
  { title: 'life.group.conditions', kinds: ['pcos', 'endometriosis', 'thyroid', 'perimenopause', 'menopause'] },
  { title: 'life.group.body', kinds: ['breastfeeding', 'postpartum', 'testosterone', 'hysterectomy', 'ablation'] },
]

export function LifeScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop, push } = useNav()
  const [adding, setAdding] = useState<LifeEventKind | 'pick' | null>(null)
  const [editing, setEditing] = useState<LifeEvent | null>(null)
  const entries = data.lifeEvents
    .filter((e) => e.kind !== 'pregnancy' && e.kind !== 'pregnancy-ended')
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  const ongoing = entries.filter((e) => !POINT_EVENTS.has(e.kind) && (!e.endDate || e.endDate >= data.today))
  const past = entries.filter((e) => !ongoing.includes(e))

  const row = (e: LifeEvent) => (
    <ListRow
      key={e.id}
      title={lifeKindName(e.kind, t)}
      sub={
        POINT_EVENTS.has(e.kind)
          ? dayMonth(e.startDate, t.locale)
          : e.endDate
            ? dateRange(e.startDate, e.endDate, t.locale, true)
            : t('life.since', { date: dayMonth(e.startDate, t.locale) })
      }
      end={<span>{t(`life.effect.${LIFE_EFFECT[e.kind]}.short` as MessageKey)}</span>}
      onClick={() => setEditing(e)}
    />
  )

  return (
    <Screen title={t('life.title')} onBack={pop}>
      <p className="mz-body-sm mz-muted mz-gutter" style={{ marginBottom: 12 }}>{t('life.intro')}</p>

      {ongoing.length > 0 && (
        <>
          <SectionTitle>{t('life.ongoing')}</SectionTitle>
          <div className="mz-section mz-list">{ongoing.map(row)}</div>
        </>
      )}
      {past.length > 0 && (
        <>
          <SectionTitle>{t('life.past')}</SectionTitle>
          <div className="mz-section mz-list">{past.map(row)}</div>
        </>
      )}

      <div className="mz-section mz-stack" style={{ marginTop: 'var(--space-4)' }}>
        <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => setAdding('pick')}>
          {t('life.add')}
        </button>
        <button type="button" className="mz-btn mz-btn--ghost" onClick={() => push({ name: 'pregnancy' })}>
          {t('life.pregnancyLink')}
        </button>
      </div>
      <p className="mz-caption mz-gutter">{t('life.selfReport')}</p>

      {adding === 'pick' && (
        <Sheet title={t('life.pick')} onClose={() => setAdding(null)}>
          <div className="mz-stack" style={{ gap: 16 }}>
            {GROUPS.map((g) => (
              <div key={g.title}>
                <div className="mz-label" style={{ margin: '0 0 8px 4px' }}>{t(g.title)}</div>
                <div className="mz-list">
                  {g.kinds.map((k) => (
                    <ListRow key={k} title={lifeKindName(k, t)} sub={t(`life.effect.${LIFE_EFFECT[k]}` as MessageKey)} onClick={() => setAdding(k)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}
      {adding && adding !== 'pick' && <LifeEditor kind={adding} today={data.today} onDone={() => setAdding(null)} />}
      {editing && <LifeEditor kind={editing.kind} existing={editing} today={data.today} onDone={() => setEditing(null)} />}
    </Screen>
  )
}

export function LifeEditor({
  kind,
  existing,
  today,
  onDone,
}: {
  kind: LifeEventKind
  existing?: LifeEvent
  today: string
  onDone: () => void
}) {
  const t = useT()
  const point = POINT_EVENTS.has(kind)
  const [start, setStart] = useState(existing?.startDate ?? today)
  const [ongoing, setOngoing] = useState(!existing?.endDate)
  const [end, setEnd] = useState(existing?.endDate ?? today)
  const [exclude, setExclude] = useState(existing?.excludeCycle ?? LIFE_EFFECT[kind] === 'exclude')
  const [note, setNote] = useState(existing?.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save() {
    const event: LifeEvent = {
      id: existing?.id ?? `${kind}-${start}-${Date.now().toString(36)}`,
      kind,
      startDate: start,
      endDate: point ? undefined : ongoing ? undefined : end < start ? start : end,
      excludeCycle: LIFE_EFFECT[kind] === 'exclude' ? exclude : undefined,
      note: kind === 'medication' && note.trim() ? note.trim() : undefined,
      outcome: existing?.outcome,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    await db.lifeEvents.put(event)
    onDone()
  }

  return (
    <Sheet
      title={lifeKindName(kind, t)}
      onClose={onDone}
      footer={
        <div className="mz-stack" style={{ gap: 8 }}>
          <button type="button" className="mz-btn mz-btn--primary mz-btn--block" onClick={() => void save()}>
            {t('common.save')}
          </button>
          {existing && !confirmDelete && (
            <button type="button" className="mz-btn mz-btn--ghost" style={{ color: 'var(--critical)' }} onClick={() => setConfirmDelete(true)}>
              {t('life.delete')}
            </button>
          )}
          {existing && confirmDelete && (
            <div className="mz-row">
              <button type="button" className="mz-btn mz-btn--secondary mz-grow" data-autofocus onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="mz-btn mz-btn--danger mz-grow"
                onClick={async () => {
                  await db.lifeEvents.delete(existing.id)
                  onDone()
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="mz-stack" style={{ gap: 16 }}>
        <p className="mz-body-sm mz-muted">{t(`life.explain.${kind}` as MessageKey)}</p>
        <label className="mz-field">
          <span className="mz-field__label">{point ? t('life.date') : t('life.started')}</span>
          <input className="mz-input" type="date" value={start} max={today} onChange={(e) => setStart(e.currentTarget.value)} />
        </label>
        {!point && (
          <div className="mz-list">
            <SwitchRow title={t('life.stillOngoing')} checked={ongoing} onChange={setOngoing} />
          </div>
        )}
        {!point && !ongoing && (
          <label className="mz-field">
            <span className="mz-field__label">{t('life.ended')}</span>
            <input className="mz-input" type="date" value={end} min={start} max={today} onChange={(e) => setEnd(e.currentTarget.value)} />
          </label>
        )}
        {LIFE_EFFECT[kind] === 'exclude' && (
          <div className="mz-list">
            <SwitchRow title={t('life.excludeCycle')} sub={t('life.excludeCycle.sub')} checked={exclude} onChange={setExclude} />
          </div>
        )}
        {kind === 'medication' && (
          <label className="mz-field">
            <span className="mz-field__label">{t('life.medicationName')}</span>
            <input className="mz-input" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
            <span className="mz-field__help">{t('life.neverShared')}</span>
          </label>
        )}
      </div>
    </Sheet>
  )
}
