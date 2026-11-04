/**
 * A short guide to the app: what each part does, with a button that opens it.
 * Reachable from Today (until she's seen it) and from You.
 */
import { useEffect } from 'react'
import { setSetting } from '../../db/schema'
import { useT, type MessageKey } from '../../i18n'
import { useNav, type Route } from '../../state/nav'
import type { CycleData } from '../../state/useCycle'
import { Icon, type IconName } from '../../ui/icons'
import { Screen } from '../../ui/kit'

export const GUIDE_SEEN = 'guide.seen'

const TOPICS: { id: string; icon: IconName; open: Route | 'log' | null }[] = [
  { id: 'log', icon: 'plus-circle', open: 'log' },
  { id: 'estimate', icon: 'calendar-check', open: { name: 'why' } },
  { id: 'calendar', icon: 'calendar-blank', open: null },
  { id: 'method', icon: 'pill', open: { name: 'method' } },
  { id: 'life', icon: 'list-checks', open: { name: 'life' } },
  { id: 'doctor', icon: 'file-text', open: { name: 'doctor-report' } },
  { id: 'partner', icon: 'hand-heart', open: { name: 'partner' } },
  { id: 'privacy', icon: 'lock-simple', open: { name: 'privacy' } },
  { id: 'reminders', icon: 'bell', open: { name: 'notifications' } },
]

export function GuideScreen({ data }: { data: CycleData }) {
  const t = useT()
  const { pop, push, openLog, setTab } = useNav()
  useEffect(() => {
    void setSetting(GUIDE_SEEN, '1')
  }, [])

  return (
    <Screen title={t('guide.title')} onBack={pop}>
      <p className="mz-gutter mz-body mz-muted" style={{ marginBottom: 16 }}>{t('guide.intro')}</p>
      <div className="mz-section mz-stack" style={{ gap: 12 }}>
        {TOPICS.map((topic) => (
          <section key={topic.id} className="mz-card mz-stack" style={{ gap: 8 }}>
            <div className="mz-row" style={{ gap: 12 }}>
              <Icon name={topic.icon} size={24} style={{ color: 'var(--primary-hi)', flex: 'none' }} />
              <h2 className="mz-title">{t(`guide.${topic.id}.title` as MessageKey)}</h2>
            </div>
            <p className="mz-body-sm mz-muted" style={{ lineHeight: 1.55 }}>{t(`guide.${topic.id}.body` as MessageKey)}</p>
            {topic.open !== null && (
              <button
                type="button"
                className="mz-btn mz-btn--secondary"
                style={{ alignSelf: 'flex-start', padding: '0 18px', minHeight: 44 }}
                onClick={() => {
                  if (topic.open === 'log') {
                    pop()
                    openLog(data.today)
                  } else if (topic.open) push(topic.open)
                }}
              >
                {t('guide.show')}
              </button>
            )}
            {topic.id === 'calendar' && (
              <button
                type="button"
                className="mz-btn mz-btn--secondary"
                style={{ alignSelf: 'flex-start', padding: '0 18px', minHeight: 44 }}
                onClick={() => {
                  pop()
                  setTab('calendar')
                }}
              >
                {t('guide.show')}
              </button>
            )}
          </section>
        ))}
      </div>
      <p className="mz-gutter mz-caption" style={{ marginTop: 16 }}>{t('guide.outro')}</p>
    </Screen>
  )
}
