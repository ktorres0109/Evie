import { create } from 'zustand'
import { en, type MessageKey } from './en'
import { es } from './es'

/** Product name. Change it here and every `{app}` placeholder follows. */
export const APP_NAME = 'Meztli'

export type Locale = 'en' | 'es'
export type LocalePreference = Locale | 'system'
export type { MessageKey }

const CATALOGUES: Record<Locale, Record<MessageKey, string>> = { en, es }
const STORAGE_KEY = 'meztli.locale'

/** Picks Spanish for any `es-*` system language, English otherwise. */
export function resolveLocale(languages: readonly string[] | undefined): Locale {
  const first = languages?.find(Boolean)?.toLowerCase() ?? 'en'
  return first === 'es' || first.startsWith('es-') ? 'es' : 'en'
}

function systemLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  return resolveLocale(navigator.languages?.length ? navigator.languages : [navigator.language])
}

function readPreference(): LocalePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'es') return stored
  } catch {
    // Storage can be unavailable (private mode, tests); fall back to the system.
  }
  return 'system'
}

export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (name === 'app') return APP_NAME
    return name in vars ? String(vars[name]) : match
  })
}

interface LocaleState {
  preference: LocalePreference
  locale: Locale
  setPreference: (preference: LocalePreference) => void
}

const initialPreference = readPreference()

export const useLocale = create<LocaleState>((set) => ({
  preference: initialPreference,
  locale: initialPreference === 'system' ? systemLocale() : initialPreference,
  setPreference: (preference) => {
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      // Not persisted; the choice still applies for this session.
    }
    const locale = preference === 'system' ? systemLocale() : preference
    if (typeof document !== 'undefined') document.documentElement.lang = locale
    set({ preference, locale })
  },
}))

/** Translate outside React (engine copy, notifications). */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const { locale } = useLocale.getState()
  return format(CATALOGUES[locale][key] ?? en[key], vars)
}

/** Translate inside React; re-renders when the language changes. */
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const locale = useLocale((state) => state.locale)
  return (key, vars) => format(CATALOGUES[locale][key] ?? en[key], vars)
}

export function catalogue(locale: Locale): Record<MessageKey, string> {
  return CATALOGUES[locale]
}
