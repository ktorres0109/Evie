import type { MessageKey } from './en'

/**
 * Spanish catalogue (Mexican Spanish, informal "tú").
 * Health copy here needs review by a native speaker and the clinician
 * before release, not only a translation of approved English.
 */
export const es: Record<MessageKey, string> = {
  'app.loading': 'Cargando {app}',
  'startup.title': '{app} no pudo abrirse.',
  'startup.body': 'Tus datos siguen en este dispositivo. Volver a cargar suele resolverlo.',
  'startup.reload': 'Volver a cargar {app}',

  'nav.label': 'Navegación principal',
  'nav.today': 'Hoy',
  'nav.calendar': 'Calendario',
  'nav.log': 'Registrar hoy',
  'nav.insights': 'Análisis',
  'nav.trends': 'Tendencias',
  'nav.you': 'Tú',
  'nav.settings': 'Ajustes',

  'settings.language': 'Idioma',
  'settings.language.system': 'Igual que el teléfono',

  'disclaimer.short': '{app} no es un dispositivo médico ni un método anticonceptivo. Las estimaciones son rangos, no promesas.',
}
