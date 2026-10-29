/**
 * Owner — Calendar (spec §5.4). One month at a time, swapped (not a carousel).
 * Solid = it happened, dashed = we think it might. The legend is permanent.
 */
import { useMemo, useState } from 'react'
import { db, dailyLogHasEntry, type DailyLog } from '../../db/schema'
import { addDays, daysBetween } from '../../engine/cycle'
import { useT } from '../../i18n'
import { dateRange, dayMonth, monthYear, weekdayInitials, weekdayLong } from '../../i18n/dates'
import { useNav } from '../../state/nav'
import type { Prefs } from '../../state/prefs'
import type { CycleData } from '../../state/useCycle'
import { Icon } from '../../ui/icons'
import { Sheet } from '../../ui/kit'
import { rangeText } from './estimateText'
import { dischargeLabel, moodLabel, symptomLabel } from './labels'

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Monday-first grid of ISO dates covering the month. */
function monthGrid(key: string): string[] {
  const first = `${key}-01`
  const dow = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7
  const start = addDays(first, -dow)
  const [y, m] = key.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells = Math.ceil((dow + daysInMonth) / 7) * 7
  return Array.from({ length: cells }, (_, i) => addDays(start, i))
}

function inRange(date: string, range: { start: string; end: string } | null | undefined): boolean {
  return Boolean(range && date >= range.start && date <= range.end)
}

export function CalendarTab({ data, prefs }: { data: CycleData; prefs: Prefs }) {
  const t = useT()
  const [month, setMonth] = useState(monthKey(data.today))
  const [selected, setSelected] = useState<string | null>(null)
  const cells = useMemo(() => monthGrid(month), [month])
  const s = data.state
  const showFertility = prefs.fertilityMode && prefs.calendarFertilityOverlay && s.fertility.state !== 'suppressed'
  const potential = s.fertility.potentialWindow

  function cellLabel(date: string, log: DailyLog | undefined): string {
    const parts = [weekdayLong(date, t.locale)]
    if (date === data.today) parts.push(t('cal.today'))
    if (log?.flow) parts.push(t('cal.loggedPeriod'))
    else if (log?.spotting) parts.push(t('flow.spotting'))
    else if (date > data.today && inRange(date, s.window)) parts.push(t('cal.estimatedPeriod'))
    if (s.withdrawalBleed && inRange(date, s.withdrawalBleed.expected) && date >= data.today) parts.push(t('cal.expectedWithdrawal'))
    if (log && dailyLogHasEntry(log) && !log.flow) parts.push(t('cal.hasEntry'))
    if (showFertility && date >= data.today && inRange(date, potential)) parts.push(t('fertility.state.potential'))
    return parts.join(', ')
  }

  const range = rangeText(s, t)

  return (
    <div className="mz-page">
      <header className="mz-appbar" style={{ paddingLeft: 'var(--space-3)' }}>
        <div className="mz-row" style={{ gap: 4 }}>
          <button type="button" className="mz-icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('cal.prev')}>
            <Icon name="caret-left" size={20} />
          </button>
          <h1 className="mz-title" style={{ margin: 0, minWidth: 150, textAlign: 'center' }} aria-live="polite">
            {monthYear(`${month}-01`, t.locale)}
          </h1>
          <button type="button" className="mz-icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t('cal.next')}>
            <Icon name="caret-right" size={20} />
          </button>
        </div>
        {month !== monthKey(data.today) ? (
          <button type="button" className="mz-btn mz-btn--ghost" onClick={() => setMonth(monthKey(data.today))}>
            {t('cal.today')}
          </button>
        ) : (
          <span style={{ width: 48 }} />
        )}
      </header>

      <div className="mz-cal">
        <div className="mz-cal__dow" aria-hidden="true">
          {weekdayInitials(t.locale).map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mz-cal__grid mz-cal__month" key={month} role="grid" aria-label={monthYear(`${month}-01`, t.locale)}>
          {cells.map((date) => {
            const log = data.logsByDate.get(date)
            const outside = monthKey(date) !== month
            const future = date > data.today
            const classes = ['mz-day']
            if (outside) classes.push('mz-day--outside')
            if (log?.flow) classes.push('mz-day--logged')
            else if (future && inRange(date, s.window)) classes.push('mz-day--predicted')
            else if (future && s.withdrawalBleed && inRange(date, s.withdrawalBleed.expected)) classes.push('mz-day--withdrawal')
            if (log?.spotting && !log.flow) classes.push('mz-day--spotting')
            else if (log && dailyLogHasEntry(log) && !log.noBleeding) classes.push('mz-day--entry')
            else if (log?.noBleeding && (log.symptoms?.length || log.moods?.length || log.notes || log.checkInComplete)) classes.push('mz-day--entry')
            if (date === data.today) classes.push('mz-day--today')
            const fert = showFertility && future && inRange(date, potential) ? 'potential' : null
            return (
              <button
                key={date}
                type="button"
                role="gridcell"
                className={classes.join(' ')}
                aria-label={cellLabel(date, log)}
                aria-current={date === data.today ? 'date' : undefined}
                onClick={() => setSelected(date)}
              >
                {Number(date.slice(8))}
                {fert && <span className={`mz-day__fert mz-day__fert--${fert}`} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>

      <section className="mz-section mz-card" style={{ marginTop: 'var(--space-5)' }} aria-label={t('cal.legend')}>
        <div className="mz-label" style={{ marginBottom: 12 }}>{t('cal.legend')}</div>
        <div className="mz-legend">
          <div className="mz-legend__item">
            <span className="mz-legend__swatch" style={{ background: 'var(--berry-deep)' }} />
            {t('cal.legend.logged')}
          </div>
          <div className="mz-legend__item">
            <span className="mz-legend__swatch" style={{ border: '1.5px dashed var(--berry-hi)' }} />
            {t('cal.legend.predicted')}
          </div>
          <div className="mz-legend__item">
            <span className="mz-legend__swatch mz-day--entry" style={{ background: 'var(--surface-2)' }} />
            {t('cal.legend.entry')}
          </div>
          <div className="mz-legend__item">
            <span className="mz-legend__swatch mz-day--spotting" style={{ background: 'var(--surface-2)' }} />
            {t('cal.legend.spotting')}
          </div>
          {s.withdrawalBleed && (
            <div className="mz-legend__item">
              <span className="mz-legend__swatch" style={{ border: '1.5px dotted var(--berry-hi)' }} />
              {t('cal.legend.withdrawal')}
            </div>
          )}
          {showFertility && (
            <div className="mz-legend__item">
              <span className="mz-legend__swatch" style={{ background: 'var(--surface-2)' }}>
                <span className="mz-day__fert mz-day__fert--potential" />
              </span>
              {t('cal.legend.potential')}
            </div>
          )}
          <div className="mz-legend__item">
            <span className="mz-legend__swatch" style={{ boxShadow: 'inset 0 0 0 2px var(--primary)' }} />
            {t('cal.today')}
          </div>
        </div>
      </section>

      {s.status === 'ok' && s.window && s.spreadDays !== null && (
        <section className="mz-section mz-card">
          <div className="mz-title" style={{ marginBottom: 6 }}>
            {t.n('cal.windowTitle', daysBetween(s.window.start, s.window.end) + 1)}
          </div>
          <p className="mz-body-sm mz-muted">
            {t('cal.windowBody', { range: range ?? '', spread: s.spreadDays })}
          </p>
        </section>
      )}

      {selected && <DaySheet date={selected} data={data} onClose={() => setSelected(null)} />}
    </div>
  )
}

function DaySheet({ date, data, onClose }: { date: string; data: CycleData; onClose: () => void }) {
  const t = useT()
  const { openLog } = useNav()
  const log = data.logsByDate.get(date)
  const future = date > data.today
  const [confirmDelete, setConfirmDelete] = useState(false)
  const s = data.state
  const items: string[] = []
  if (log?.flow) items.push(t('cal.day.flow', { level: t(`flow.${log.flow === 'very-heavy' ? 'veryHeavy' : log.flow === 'clots' ? 'heavy' : log.flow}`) }))
  if (log?.spotting) items.push(t('flow.spotting'))
  if (log?.noBleeding) items.push(t('cal.day.noBleeding'))
  if (log?.symptoms?.length) items.push(log.symptoms.map((x) => symptomLabel(x, t)).join(', '))
  if (log?.moods?.length) items.push(log.moods.map((x) => moodLabel(x, t)).join(', '))
  if (log?.discharge) items.push(dischargeLabel(log.discharge, t))
  if (log?.bbt !== undefined) items.push(t('cal.day.bbtLogged'))
  if (log?.opk) items.push(t('cal.day.opk', { result: t(`opk.${log.opk}`) }))
  if (log?.notes) items.push(t('cal.day.note'))
  const isStart = log?.flow && !data.logsByDate.get(addDays(date, -1))?.flow

  return (
    <Sheet
      title={weekdayLong(date, t.locale)}
      onClose={onClose}
      footer={
        future ? undefined : (
          <div className="mz-stack" style={{ gap: 10 }}>
            <button
              type="button"
              className="mz-btn mz-btn--primary mz-btn--block"
              onClick={() => {
                onClose()
                openLog(date)
              }}
            >
              {log ? t('cal.day.edit') : t('cal.day.log')}
            </button>
            {log && !confirmDelete && (
              <button type="button" className="mz-btn mz-btn--ghost" style={{ color: 'var(--critical)' }} onClick={() => setConfirmDelete(true)}>
                {t('cal.day.delete')}
              </button>
            )}
            {confirmDelete && (
              <div className="mz-card mz-card--sm mz-card--raised mz-stack">
                <p className="mz-body-sm">{isStart ? t('cal.day.deleteStart') : t('cal.day.deleteConfirm')}</p>
                <div className="mz-row">
                  <button type="button" className="mz-btn mz-btn--secondary mz-grow" data-autofocus onClick={() => setConfirmDelete(false)}>
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="mz-btn mz-btn--danger mz-grow"
                    onClick={async () => {
                      await db.dailyLogs.delete(date)
                      void import('../../native/runtime').then((m) => m.destructiveTap())
                      onClose()
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      }
    >
      {future ? (
        <div className="mz-stack">
          {s.window && date >= s.window.start && date <= s.window.end ? (
            <p className="mz-body">{t('cal.day.futureInWindow', { range: dateRange(s.window.start, s.window.end, t.locale) })}</p>
          ) : (
            <p className="mz-body mz-muted">{t('cal.day.futureNothing')}</p>
          )}
          <p className="mz-caption">{t('cal.day.futureNote')}</p>
        </div>
      ) : items.length ? (
        <ul className="mz-stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 8 }}>
          {items.map((item, i) => (
            <li key={i} className="mz-body-sm">
              {item}
            </li>
          ))}
          {isStart && <li className="mz-caption">{t('cal.day.isStart', { date: dayMonth(date, t.locale) })}</li>}
        </ul>
      ) : (
        <p className="mz-body-sm mz-muted">{t('cal.day.empty')}</p>
      )}
    </Sheet>
  )
}
