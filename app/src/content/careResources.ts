/**
 * Support resources shown after a pregnancy ends and in Privacy & data.
 * US-focused, non-judgemental, and verified against each organisation's own
 * site on `lastChecked`. Recheck before every release; numbers and hours change.
 * Not legal advice, and Meztli is not affiliated with any of them.
 */
export interface CareResource {
  id: string
  name: string
  /** Display phone, and a tel: target. */
  phone: string
  tel: string
  /** What it is for, as a catalogue key. */
  about: 'loss-abortion-medical' | 'all-options' | 'postpartum' | 'crisis'
  spanish: boolean
  source: string
}

export const RESOURCES_LAST_CHECKED = '2026-10-29'

export const CARE_RESOURCES: CareResource[] = [
  {
    id: 'ma-hotline',
    name: 'Miscarriage + Abortion Hotline',
    phone: '1-833-246-2632',
    tel: '+18332462632',
    about: 'loss-abortion-medical',
    spanish: false,
    source: 'https://mahotline.org/',
  },
  {
    id: 'all-options',
    name: 'All-Options Talkline',
    phone: '1-888-493-0092',
    tel: '+18884930092',
    about: 'all-options',
    spanish: false,
    source: 'https://www.all-options.org/find-support/talkline/',
  },
  {
    id: 'psi',
    name: 'Postpartum Support International',
    phone: '1-800-944-4773',
    tel: '+18009444773',
    about: 'postpartum',
    spanish: true,
    source: 'https://postpartum.net/',
  },
  {
    id: '988',
    name: '988 Suicide & Crisis Lifeline',
    phone: '988',
    tel: '988',
    about: 'crisis',
    spanish: true,
    source: 'https://988lifeline.org/',
  },
]

/**
 * Warning signs after a miscarriage or abortion, from ACOG's Early Pregnancy
 * Loss FAQ and NICHD. Shown as catalogue keys so both languages carry them.
 */
export const AFTERCARE_SOURCES = [
  'https://www.acog.org/womens-health/faqs/early-pregnancy-loss',
  'https://www.nichd.nih.gov/health/topics/factsheets/pregnancyloss',
]
