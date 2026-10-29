/**
 * Locale-aware date text. Dates are ISO strings ('YYYY-MM-DD') read at local
 * noon so a time zone never shifts the day.
 */
import type { Locale } from './index'

const TAG: Record<Locale, string> = { en: 'en-US', es: 'es-MX' }

function asDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function fmt(iso: string, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(TAG[locale], options).format(asDate(iso))
}

/** "August 18" / "18 de agosto" */
export function dayMonth(iso: string, locale: Locale): string {
  return fmt(iso, locale, { month: 'long', day: 'numeric' })
}

/** "Aug 18" / "18 ago" */
export function dayMonthShort(iso: string, locale: Locale): string {
  return fmt(iso, locale, { month: 'short', day: 'numeric' })
}

/** "Thursday, August 6" / "jueves, 6 de agosto" */
export function weekdayLong(iso: string, locale: Locale): string {
  const s = fmt(iso, locale, { weekday: 'long', month: 'long', day: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "August 2026" / "agosto de 2026", capitalised. */
export function monthYear(iso: string, locale: Locale): string {
  const s = fmt(iso, locale, { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "August 18 – 21" / "18–21 de agosto". Uses Intl's own range rules. */
export function dateRange(start: string, end: string, locale: Locale, short = false): string {
  const f = new Intl.DateTimeFormat(TAG[locale], { month: short ? 'short' : 'long', day: 'numeric' })
  const range = (f as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string }).formatRange
  return range ? range.call(f, asDate(start), asDate(end)) : `${f.format(asDate(start))} – ${f.format(asDate(end))}`
}

/** Narrow weekday initials starting Monday: M T W T F S S / L M M J V S D. */
export function weekdayInitials(locale: Locale): string[] {
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    fmt(`2024-01-0${i + 1}`, locale, { weekday: 'narrow' }).toUpperCase(),
  )
}

export function relativeAgo(fromIso: string, nowMs: number, locale: Locale): string {
  const diffMin = Math.round((new Date(fromIso).getTime() - nowMs) / 60000)
  const rtf = new Intl.RelativeTimeFormat(TAG[locale], { numeric: 'auto' })
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  const diffH = Math.round(diffMin / 60)
  if (Math.abs(diffH) < 48) return rtf.format(diffH, 'hour')
  return rtf.format(Math.round(diffH / 24), 'day')
}

/** "November 12 and 16" / "12 y el 16 de noviembre": for "between … and …" sentences. */
export function betweenDates(start: string, end: string, locale: Locale): string {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  if (locale === 'es') {
    return sameMonth
      ? `${Number(start.slice(8))} y el ${dayMonth(end, locale)}`
      : `${dayMonth(start, locale)} y el ${dayMonth(end, locale)}`
  }
  return sameMonth ? `${dayMonth(start, locale)} and ${Number(end.slice(8))}` : `${dayMonth(start, locale)} and ${dayMonth(end, locale)}`
}
