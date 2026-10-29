/**
 * Meztli component kit (design spec §04). Small, dependency-free building
 * blocks; every screen composes these instead of styling from scratch.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { Confidence, FertilityState } from '../engine/estimate'
import { useT } from '../i18n'
import { pushBackHandler } from '../lib/back'
import { Icon, type IconName } from './icons'

// ---------------------------------------------------------------------------
// App bars
// ---------------------------------------------------------------------------

export function BrandBar({ trailing }: { trailing?: ReactNode }) {
  return (
    <header className="mz-appbar">
      <div className="mz-brand">
        <span className="mz-brand__dot" aria-hidden="true" />
        <span className="mz-brand__name">Meztli</span>
      </div>
      {trailing}
    </header>
  )
}

export function BackBar({ title, onBack, trailing }: { title?: string; onBack: () => void; trailing?: ReactNode }) {
  const t = useT()
  return (
    <header className="mz-appbar mz-appbar--back">
      <button type="button" className="mz-icon-btn" onClick={onBack} aria-label={t('common.back')}>
        <Icon name="caret-left" size={22} />
      </button>
      {title ? <h1 className="mz-appbar__title">{title}</h1> : <span className="mz-grow" />}
      {trailing}
    </header>
  )
}

/** A full-screen pushed view (translateX + fade on enter). */
export function Screen({
  title,
  onBack,
  trailing,
  children,
  label,
}: {
  title?: string
  onBack: () => void
  trailing?: ReactNode
  children: ReactNode
  label?: string
}) {
  useBackButton(onBack)
  return (
    <div className="mz-overlay" role="dialog" aria-modal="true" aria-label={label ?? title}>
      <div className="mz-main">
        <BackBar title={title} onBack={onBack} trailing={trailing} />
        <div className="mz-page mz-page--flush-bottom">{children}</div>
      </div>
    </div>
  )
}

/** Android hardware back (and Escape) closes the top-most overlay. */
export function useBackButton(handler: () => void) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => pushBackHandler(() => ref.current()), [])
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export function Sheet({
  title,
  onClose,
  children,
  footer,
  full = false,
  subtitle,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  full?: boolean
}) {
  const t = useT()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  useBackButton(onClose)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('[data-autofocus], button, input, textarea')?.focus({ preventScroll: true })
    return () => previous?.focus?.({ preventScroll: true })
  }, [])
  return (
    <>
      <div className="mz-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={`mz-sheet${full ? ' mz-sheet--full' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || !panel.current) return
          const focusable = [...panel.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
            (el) => !el.hasAttribute('disabled'),
          )
          if (!focusable.length) return
          const first = focusable[0]
          const last = focusable.at(-1)!
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        <div className="mz-sheet__head">
          <span className="mz-sheet__handle" aria-hidden="true" />
          <div className="mz-grow" style={{ paddingTop: 12 }}>
            <h2 id={titleId} className="mz-title" style={{ margin: 0 }}>
              {title}
            </h2>
            {subtitle && <div className="mz-caption">{subtitle}</div>}
          </div>
          <button type="button" className="mz-icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={22} />
          </button>
        </div>
        <div className="mz-sheet__body">{children}</div>
        {footer && <div className="mz-sheet__foot">{footer}</div>}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Lists and controls
// ---------------------------------------------------------------------------

export function ListRow({
  icon,
  title,
  sub,
  end,
  onClick,
  danger,
  chevron = true,
  disabled,
}: {
  icon?: IconName
  title: ReactNode
  sub?: ReactNode
  end?: ReactNode
  onClick?: () => void
  danger?: boolean
  chevron?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`mz-list-row${danger ? ' mz-list-row--danger' : ''}`}
      onClick={onClick}
      disabled={disabled || !onClick}
    >
      {icon && <Icon name={icon} size={22} className="mz-list-row__icon" />}
      <span className="mz-list-row__text">
        <span className="mz-list-row__title">{title}</span>
        {sub && <span className="mz-list-row__sub">{sub}</span>}
      </span>
      <span className="mz-list-row__end">
        {end}
        {chevron && onClick && <Icon name="caret-right" size={16} />}
      </span>
    </button>
  )
}

/** A switch whose spoken label includes its consequence (spec §04). */
export function SwitchRow({
  title,
  sub,
  checked,
  onChange,
  disabled,
  icon,
}: {
  title: string
  sub?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  icon?: IconName
}) {
  const id = useId()
  return (
    <div className="mz-list-row" style={{ cursor: 'default' }}>
      {icon && <Icon name={icon} size={22} className="mz-list-row__icon" />}
      <span className="mz-list-row__text" id={id}>
        <span className="mz-list-row__title">{title}</span>
        {sub && <span className="mz-list-row__sub">{sub}</span>}
      </span>
      <button
        type="button"
        role="switch"
        className="mz-switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  more,
  onLongPress,
}: {
  selected?: boolean
  onClick: () => void
  children: ReactNode
  more?: boolean
  onLongPress?: () => void
}) {
  const timer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)
  return (
    <button
      type="button"
      className={`mz-chip${more ? ' mz-chip--more' : ''}`}
      aria-pressed={more ? undefined : Boolean(selected)}
      onPointerDown={() => {
        if (!onLongPress) return
        longPressed.current = false
        timer.current = window.setTimeout(() => {
          longPressed.current = true
          onLongPress()
        }, 480)
      }}
      onPointerUp={() => window.clearTimeout(timer.current)}
      onPointerLeave={() => window.clearTimeout(timer.current)}
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false
          return
        }
        onClick()
      }}
    >
      {selected && !more && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  )
}

export function Segment<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string; long?: string }[]
  value: T | undefined
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div className="mz-segment" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          aria-label={option.long ?? option.label}
          className="mz-segment__opt"
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Health signals
// ---------------------------------------------------------------------------

export function ConfidenceMeter({ level }: { level: Confidence }) {
  const t = useT()
  return (
    <div className="mz-meter" role="img" aria-label={t('confidence.aria', { n: level, word: t(`confidence.${level}`) })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`mz-meter__seg${i <= level ? ' is-on' : ''}`} style={{ animationDelay: `${i * 30}ms` }} />
      ))}
    </div>
  )
}

const FERT_GLYPH: Record<FertilityState, string> = { potential: '◆', unknown: '?', lower: '—', suppressed: '○' }

export function FertilityChip({
  state,
  onClick,
  sub,
}: {
  state: FertilityState
  onClick?: () => void
  sub?: string
}) {
  const t = useT()
  const content = (
    <>
      <span className="mz-fert__glyph" aria-hidden="true">
        {FERT_GLYPH[state]}
      </span>
      <span className="mz-grow">
        <span className="mz-fert__title" style={{ display: 'block' }}>
          {t(`fertility.state.${state}`)}
        </span>
        <span className="mz-fert__sub" style={{ display: 'block' }}>
          {sub ?? t(`fertility.state.${state}.sub`)}
        </span>
      </span>
      {onClick && <Icon name="caret-right" size={16} className="mz-faint" />}
    </>
  )
  return onClick ? (
    <button type="button" className={`mz-fert mz-fert--${state} mz-press`} onClick={onClick} style={{ cursor: 'pointer' }}>
      {content}
    </button>
  ) : (
    <div className={`mz-fert mz-fert--${state}`}>{content}</div>
  )
}

export function Banner({
  tone,
  icon,
  title,
  children,
  role,
}: {
  tone: 'critical' | 'care' | 'info' | 'disclaimer'
  icon?: IconName
  title?: string
  children?: ReactNode
  role?: 'alert' | 'status'
}) {
  return (
    <div className={`mz-banner mz-banner--${tone}`} role={role}>
      {icon && <Icon name={icon} size={22} style={{ flex: 'none', marginTop: 1 }} />}
      <div className="mz-grow mz-stack" style={{ gap: 4 }}>
        {title && <strong style={{ fontWeight: 600, fontSize: 15 }}>{title}</strong>}
        {children && <div className="mz-body-sm">{children}</div>}
      </div>
    </div>
  )
}

export function SavedStrip({ text }: { text: string }) {
  return (
    <div className="mz-saved mz-banner--care" role="status" aria-live="polite">
      <Icon name="check-circle:fill" size={20} style={{ color: 'var(--care)' }} />
      <span>{text}</span>
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mz-label mz-section-title" style={{ fontSize: 12 }}>
      {children}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Companion plant (placeholder art: five flat stages, no animation)
// ---------------------------------------------------------------------------

export function Plant({ stage, resting, large }: { stage: number; resting?: boolean; large?: boolean }) {
  const leaf = (d: string, fill: string, key: string) => <path key={key} d={d} fill={fill} />
  const leaves: JSX.Element[] = []
  const s = Math.max(0, Math.min(5, stage))
  // Stem grows with stage.
  const stemTop = 34 - s * 3
  if (s >= 1) leaves.push(leaf('M26 33 C18 31 13 26 12 21 C19 21 24 25 26 33 Z', '#6f9a6b', 'l1'))
  if (s >= 2) leaves.push(leaf('M26 30 C33 28 38 23 39 18 C32 18 27 22 26 30 Z', '#5f8a5c', 'l2'))
  if (s >= 3) {
    leaves.push(leaf('M26 25 C19 23 15 18 15 13 C21 14 25 18 26 25 Z', '#7fae79', 'l3'))
    leaves.push(leaf('M26 23 C32 21 36 16 36 11 C30 12 27 16 26 23 Z', '#6f9a6b', 'l4'))
  }
  if (s >= 4) leaves.push(leaf('M26 18 C22 15 21 10 23 6 C27 9 28 14 26 18 Z', '#8fbf88', 'l5'))
  return (
    <svg
      viewBox="0 0 52 56"
      className={`mz-plant${large ? ' mz-plant--lg' : ''}${resting ? ' is-resting' : ''}`}
      aria-hidden="true"
    >
      {s >= 1 && <rect x="25" y={stemTop} width="2" height={45 - stemTop} fill="#5f7a5c" rx="1" />}
      {s === 0 && <ellipse cx="26" cy="37" rx="3" ry="2" fill="#8a7f6a" />}
      {leaves}
      {s >= 5 && (
        <g>
          <circle cx="26" cy="6" r="4.5" fill="#C2496F" />
          <circle cx="26" cy="6" r="1.8" fill="#F3EFF7" />
        </g>
      )}
      <path d="M13 37 H39 L36 54 H16 Z" fill={resting ? '#2E2840' : '#3A3350'} />
      {!resting && <rect x="13" y="37" width="26" height="2" fill="#4a4262" />}
    </svg>
  )
}
