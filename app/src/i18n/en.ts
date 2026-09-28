/**
 * English string catalogue: the source of truth for keys.
 *
 * Every user-facing string moves here as its screen is redesigned. `{app}` is
 * filled with the product name automatically; other `{name}` placeholders
 * come from the caller. Spanish must carry the same keys and placeholders
 * (enforced by i18n.test.ts).
 */
export const en = {
  'app.loading': 'Loading {app}',
  'startup.title': '{app} couldn’t open.',
  'startup.body': 'Your data is still on this device. Reloading usually fixes this.',
  'startup.reload': 'Reload {app}',

  'nav.label': 'Main navigation',
  'nav.today': 'Today',
  'nav.calendar': 'Calendar',
  'nav.log': 'Log today',
  'nav.insights': 'Insights',
  'nav.trends': 'Trends',
  'nav.you': 'You',
  'nav.settings': 'Settings',

  'settings.language': 'Language',
  'settings.language.system': 'Match phone',

  'disclaimer.short': '{app} is not a medical device and is not contraception. Estimates are ranges, not promises.',
} as const

export type MessageKey = keyof typeof en
