/**
 * Bottom navigation (spec §5.0). Icon-only, filled when selected, with a
 * raised Log button in the middle for the owner. Every slot is 52×48 and has
 * a spoken label with its position ("Calendar, tab 2 of 5").
 */
import { useT, type MessageKey } from '../i18n'
import type { AnyTab, OwnerTab, PartnerTab } from '../state/nav'
import { Icon, type IconName } from './icons'

interface Slot<T extends AnyTab> {
  id: T
  icon: IconName
  label: MessageKey
}

const OWNER: Slot<OwnerTab>[] = [
  { id: 'today', icon: 'house', label: 'nav.today' },
  { id: 'calendar', icon: 'calendar-blank', label: 'nav.calendar' },
  { id: 'insights', icon: 'chart-line', label: 'nav.insights' },
  { id: 'you', icon: 'user', label: 'nav.you' },
]

const PARTNER: Slot<PartnerTab>[] = [
  { id: 'p-today', icon: 'house', label: 'nav.today' },
  { id: 'p-support', icon: 'hand-heart', label: 'nav.support' },
  { id: 'p-shared', icon: 'eye', label: 'nav.shared' },
  { id: 'p-you', icon: 'user', label: 'nav.you' },
]

function scrollMainToTop() {
  document.querySelector('.mz-main')?.scrollTo({ top: 0, behavior: 'smooth' })
}

export function NavBar({
  role,
  active,
  onChange,
  onLog,
}: {
  role: 'owner' | 'partner'
  active: AnyTab
  onChange: (tab: AnyTab) => void
  onLog?: () => void
}) {
  const t = useT()
  const slots: Slot<AnyTab>[] = role === 'owner' ? OWNER : PARTNER
  const total = slots.length + (role === 'owner' ? 1 : 0)

  const tab = (slot: Slot<AnyTab>, position: number) => {
    const selected = slot.id === active
    return (
      <button
        key={slot.id}
        type="button"
        className="mz-tab"
        aria-current={selected ? 'page' : undefined}
        aria-label={t('nav.position', { label: t(slot.label), n: position, total })}
        onClick={() => (selected ? scrollMainToTop() : onChange(slot.id))}
      >
        <Icon name={selected ? (`${slot.icon}:fill` as IconName) : slot.icon} size={24} />
      </button>
    )
  }

  return (
    <nav className="mz-tabbar" aria-label={t('nav.label')}>
      <div className="mz-tabbar__fade" aria-hidden="true" />
      <div className="mz-tabbar__bar">
        {role === 'owner' ? (
          <>
            {tab(slots[0], 1)}
            {tab(slots[1], 2)}
            <button
              type="button"
              className="mz-tab__log"
              onClick={onLog}
              aria-label={t('nav.position', { label: t('nav.log'), n: 3, total })}
            >
              <Icon name="plus:bold" size={28} />
            </button>
            {tab(slots[2], 4)}
            {tab(slots[3], 5)}
          </>
        ) : (
          slots.map((slot, i) => tab(slot, i + 1))
        )}
      </div>
    </nav>
  )
}
