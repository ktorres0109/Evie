/**
 * Terms of Use and Privacy Policy, shown in the app and mirrored in
 * docs/legal/. This file is the canonical text; bump LEGAL_VERSION whenever
 * the meaning changes and the app asks everyone to read and agree again.
 *
 * Drafted to describe exactly what the app does. Not reviewed by a lawyer.
 */
import type { Locale } from '../i18n'

export const LEGAL_VERSION = '2026-11-04'
export const SOURCE_URL = 'https://github.com/ktorres0109/Evie'

export type LegalDoc = 'terms' | 'privacy'

export interface LegalSection {
  heading: string
  body: string[]
}

export interface LegalText {
  title: string
  updated: string
  summary: string[]
  sections: LegalSection[]
}

const en: Record<LegalDoc, LegalText> = {
  terms: {
    title: 'Terms of Use',
    updated: 'Last updated November 4, 2026',
    summary: [
      'Meztli helps you understand your own cycle. It gives estimates, not diagnoses, and it is not birth control.',
      'What you log stays on your phone. You decide if anything is shared, and you can stop at any time.',
      'It is free, open-source software, offered as is.',
    ],
    sections: [
      {
        heading: 'Who we are',
        body: [
          'Meztli is an independent, open-source project, not a company. "We" means the people who build and maintain it. The source code is public at ' + SOURCE_URL + '.',
          'By using Meztli you agree to these terms. If you don’t agree, please don’t use it.',
        ],
      },
      {
        heading: 'Who can use it',
        body: [
          'You must be at least 13 years old, or at least 16 in the European Union, the United Kingdom or Canada. If the law where you live requires a parent’s or guardian’s permission for someone your age, you need it.',
        ],
      },
      {
        heading: 'Not medical advice, not birth control',
        body: [
          'Meztli is not a medical device. Its estimates (your next period, fertile days, patterns) come from what you log and can be wrong, especially with few cycles, irregular cycles, recent pregnancy, hormonal birth control or health conditions.',
          'Do not use Meztli to prevent pregnancy. If avoiding pregnancy matters to you, use a method designed for it and talk to a clinician.',
          'Nothing in the app replaces a doctor, nurse, physician assistant, midwife or pharmacist. If something feels wrong, get care. In an emergency call 911 (or your local emergency number).',
        ],
      },
      {
        heading: 'Your data',
        body: [
          'Everything you log is stored on your phone. We do not run an account system and do not receive your logs.',
          'Because it lives only on your phone, keeping it safe is in your hands: uninstalling the app or losing the phone deletes it unless you made an export (You → Privacy & data → Export everything).',
          'The Privacy Policy explains exactly what is stored, where, and what leaves your phone.',
        ],
      },
      {
        heading: 'Partner sharing',
        body: [
          'You can choose to share a small, read-only view with one person. You pick what is shared, you confirm the pairing in person, and you can pause or stop it at any time. Some things are never shared, whatever you choose.',
          'Only use partner sharing with someone you trust and only by your own choice. Never use Meztli to watch or track another person without their knowledge and consent.',
          'If you are the partner: what you see belongs to the person who shares it. Respect their choice to change or end it.',
        ],
      },
      {
        heading: 'Fair use',
        body: [
          'Don’t misuse the sharing service: no attempts to break, overload, or access mailboxes that aren’t yours.',
          'The code is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). You may study, change and share it under that license. Meztli builds on Lunara by Blueturboguy07 and contributors.',
        ],
      },
      {
        heading: 'No warranty',
        body: [
          'Meztli is provided "as is", without warranties of any kind, to the fullest extent the law allows. We do our best to make it accurate, private and reliable, but we can’t promise it will always work or be error-free.',
          'To the fullest extent the law allows, we are not liable for any indirect or consequential loss arising from using the app, including decisions based on its estimates or data lost from your phone. Nothing here limits rights you have that can’t be waived under the law where you live.',
        ],
      },
      {
        heading: 'Changes and ending',
        body: [
          'If we change these terms in a way that matters, the app will show the new version and ask you to agree before you continue.',
          'You can stop using Meztli at any time. You → Privacy & data → Delete everything erases all of it from this phone.',
          'These terms are governed by the laws of California, USA, except where the law where you live says otherwise.',
          'Questions: open an issue at ' + SOURCE_URL + '/issues.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated November 4, 2026',
    summary: [
      'We don’t collect your data. What you log is stored on your phone, not on our servers.',
      'No account, no ads, no analytics, no tracking, no selling, no AI.',
      'Partner sharing is off until you turn it on, and what it sends is encrypted so we can’t read it.',
    ],
    sections: [
      {
        heading: 'What is stored on your phone',
        body: [
          'Your period and flow, symptoms, moods, notes, tests and temperatures you log; birth control and life events you add (such as pregnancy, illness or stress); and your settings.',
          'This lives inside the app’s private storage on your phone, which is protected by your phone’s own encryption. You can add a PIN or fingerprint lock in the app.',
          'We never see it. There is no Meztli server holding a copy.',
        ],
      },
      {
        heading: 'What leaves your phone, and only if you choose',
        body: [
          'Partner sharing: only the categories you pick are sent. They are encrypted on your phone with a key that exists only on the two paired phones, and padded to a fixed size. They pass through a small relay server that stores one encrypted copy for your partner to pick up. The relay cannot read it.',
          'What the relay can see: the network (IP) addresses that connect to it, when an update is sent, and that two devices share a mailbox. It keeps no request logs. Stopping sharing deletes the stored copy; an unused mailbox deletes itself after 60 days.',
          'Never shared with a partner, whatever you choose: your notes, your full history, sex and contraception, tests and their results, temperatures and ovulation tests, medical details, and pregnancy history (including a pregnancy that ended).',
          'Exports: files you create yourself and save wherever you choose. You can lock them with a passphrase. Pregnancy history is left out unless you include it.',
          'The Privacy & data screen keeps a list of every time something left your phone.',
        ],
      },
      {
        heading: 'What we never do',
        body: [
          'No analytics or crash reporting, no advertising, no third-party trackers, no selling or sharing data with anyone, and no AI that reads your entries.',
        ],
      },
      {
        heading: 'Notifications and the widget',
        body: [
          'Reminders are scheduled on your phone. Their text never names your period, fertility or other health details, so it is safe on a lock screen.',
          'The home-screen widget shows only the app name unless you turn on "Show your cycle on the widget", and it stays private while the app lock is on.',
        ],
      },
      {
        heading: 'Requests for your data',
        body: [
          'Because we don’t hold your health data, we can’t hand it over to anyone: not to advertisers, data brokers, or in response to legal demands. The relay holds only encrypted copies we cannot open, and only while sharing is on.',
          'Laws that give you rights over health data a company holds (for example access or deletion) apply to us in the simplest way: we hold none. To delete everything, use You → Privacy & data → Delete everything, and stop partner sharing.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'Meztli is for people aged 13 and older (16 and older in the EU, UK and Canada). We don’t knowingly receive anyone’s data, including children’s.',
        ],
      },
      {
        heading: 'Changes and contact',
        body: [
          'If this policy changes in a way that matters, the app will show the new version and ask you to agree again.',
          'Questions: open an issue at ' + SOURCE_URL + '/issues. The code is public, so you can check every claim here yourself.',
        ],
      },
    ],
  },
}

const es: Record<LegalDoc, LegalText> = {
  terms: {
    title: 'Términos de uso',
    updated: 'Última actualización: 4 de noviembre de 2026',
    summary: [
      'Meztli te ayuda a entender tu propio ciclo. Da estimaciones, no diagnósticos, y no es un método anticonceptivo.',
      'Lo que registras se queda en tu teléfono. Tú decides si compartes algo y puedes dejar de hacerlo cuando quieras.',
      'Es software gratuito y de código abierto, ofrecido tal cual.',
    ],
    sections: [
      {
        heading: 'Quiénes somos',
        body: [
          'Meztli es un proyecto independiente y de código abierto, no una empresa. "Nosotros" se refiere a quienes lo crean y mantienen. El código es público en ' + SOURCE_URL + '.',
          'Al usar Meztli aceptas estos términos. Si no estás de acuerdo, por favor no lo uses.',
        ],
      },
      {
        heading: 'Quién puede usarlo',
        body: [
          'Debes tener al menos 13 años, o al menos 16 en la Unión Europea, el Reino Unido o Canadá. Si la ley de donde vives exige permiso de tu madre, padre o tutor para alguien de tu edad, lo necesitas.',
        ],
      },
      {
        heading: 'No es consejo médico ni anticonceptivo',
        body: [
          'Meztli no es un dispositivo médico. Sus estimaciones (tu próximo periodo, días fértiles, patrones) salen de lo que registras y pueden fallar, sobre todo con pocos ciclos, ciclos irregulares, un embarazo reciente, anticonceptivos hormonales o condiciones de salud.',
          'No uses Meztli para evitar un embarazo. Si eso te importa, usa un método diseñado para ello y habla con un profesional de salud.',
          'Nada en la app sustituye a un médico, enfermera, asistente médico, partera o farmacéutico. Si algo no se siente bien, busca atención. En una emergencia llama al 911 (o al número de emergencias de tu país).',
        ],
      },
      {
        heading: 'Tus datos',
        body: [
          'Todo lo que registras se guarda en tu teléfono. No tenemos un sistema de cuentas ni recibimos tus registros.',
          'Como solo vive en tu teléfono, cuidarlo depende de ti: desinstalar la app o perder el teléfono lo borra, a menos que hayas hecho una exportación (Tú → Privacidad y datos → Exportar todo).',
          'La Política de privacidad explica exactamente qué se guarda, dónde y qué sale de tu teléfono.',
        ],
      },
      {
        heading: 'Compartir con tu pareja',
        body: [
          'Puedes compartir una vista pequeña, de solo lectura, con una persona. Tú eliges qué se comparte, confirmas el enlace en persona y puedes pausarlo o terminarlo cuando quieras. Hay cosas que nunca se comparten, elijas lo que elijas.',
          'Úsalo solo con alguien de confianza y por decisión propia. Nunca uses Meztli para vigilar o rastrear a otra persona sin que lo sepa y lo acepte.',
          'Si eres la pareja: lo que ves pertenece a quien lo comparte. Respeta su decisión de cambiarlo o terminarlo.',
        ],
      },
      {
        heading: 'Uso justo',
        body: [
          'No abuses del servicio para compartir: nada de intentar romperlo, saturarlo o entrar a buzones que no son tuyos.',
          'El código tiene licencia GNU Affero General Public License v3.0 (AGPL-3.0). Puedes estudiarlo, modificarlo y compartirlo bajo esa licencia. Meztli se basa en Lunara de Blueturboguy07 y colaboradores.',
        ],
      },
      {
        heading: 'Sin garantía',
        body: [
          'Meztli se ofrece "tal cual", sin garantías de ningún tipo, en la medida máxima que permita la ley. Hacemos lo posible para que sea preciso, privado y confiable, pero no podemos prometer que siempre funcione o que no tenga errores.',
          'En la medida máxima que permita la ley, no somos responsables de pérdidas indirectas por usar la app, incluidas decisiones basadas en sus estimaciones o datos perdidos de tu teléfono. Nada de esto limita derechos que la ley de donde vives no permite renunciar.',
        ],
      },
      {
        heading: 'Cambios y terminación',
        body: [
          'Si cambiamos estos términos de forma importante, la app te mostrará la nueva versión y te pedirá aceptarla antes de seguir.',
          'Puedes dejar de usar Meztli cuando quieras. Tú → Privacidad y datos → Borrar todo lo elimina de este teléfono.',
          'Estos términos se rigen por las leyes de California, EE. UU., salvo donde la ley de tu lugar de residencia diga otra cosa.',
          'Preguntas: abre un reporte en ' + SOURCE_URL + '/issues.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Política de privacidad',
    updated: 'Última actualización: 4 de noviembre de 2026',
    summary: [
      'No recopilamos tus datos. Lo que registras se guarda en tu teléfono, no en nuestros servidores.',
      'Sin cuenta, sin anuncios, sin analíticas, sin rastreo, sin venta de datos, sin IA.',
      'Compartir con tu pareja está apagado hasta que lo actives, y lo que envía va cifrado para que nosotros no podamos leerlo.',
    ],
    sections: [
      {
        heading: 'Qué se guarda en tu teléfono',
        body: [
          'Tu periodo y flujo, síntomas, ánimo, notas, pruebas y temperaturas que registres; el anticonceptivo y los eventos de vida que agregues (como embarazo, enfermedad o estrés); y tus ajustes.',
          'Todo vive dentro del almacenamiento privado de la app en tu teléfono, protegido por el cifrado de tu propio teléfono. Puedes agregar un PIN o huella en la app.',
          'Nunca lo vemos. No hay un servidor de Meztli con una copia.',
        ],
      },
      {
        heading: 'Qué sale de tu teléfono, y solo si tú eliges',
        body: [
          'Compartir con tu pareja: solo se envían las categorías que elijas. Se cifran en tu teléfono con una clave que solo existe en los dos teléfonos enlazados, y se rellenan a un tamaño fijo. Pasan por un pequeño servidor de enlace (relay) que guarda una copia cifrada para que tu pareja la recoja. El relay no puede leerla.',
          'Lo que el relay sí puede ver: las direcciones de red (IP) que se conectan, cuándo se envía una actualización y que dos dispositivos comparten un buzón. No guarda registros de solicitudes. Al dejar de compartir se borra la copia; un buzón sin uso se borra solo a los 60 días.',
          'Nunca se comparte con tu pareja, elijas lo que elijas: tus notas, tu historial completo, sexo y anticonceptivos, pruebas y sus resultados, temperatura basal y pruebas de ovulación, datos médicos e historial de embarazos (incluido un embarazo que terminó).',
          'Exportaciones: archivos que tú creas y guardas donde quieras. Puedes protegerlos con una contraseña. El historial de embarazo queda fuera a menos que lo incluyas.',
          'La pantalla Privacidad y datos guarda una lista de cada vez que algo salió de tu teléfono.',
        ],
      },
      {
        heading: 'Lo que nunca hacemos',
        body: [
          'Sin analíticas ni reportes de errores, sin publicidad, sin rastreadores de terceros, sin vender ni compartir datos con nadie y sin IA que lea lo que registras.',
        ],
      },
      {
        heading: 'Notificaciones y widget',
        body: [
          'Los recordatorios se programan en tu teléfono. Su texto nunca menciona tu periodo, fertilidad ni otros datos de salud, así que es seguro en la pantalla de bloqueo.',
          'El widget de la pantalla de inicio solo muestra el nombre de la app a menos que actives "Mostrar tu ciclo en el widget", y se mantiene privado mientras el bloqueo de la app esté activo.',
        ],
      },
      {
        heading: 'Solicitudes de tus datos',
        body: [
          'Como no tenemos tus datos de salud, no podemos entregárselos a nadie: ni a anunciantes, ni a corredores de datos, ni ante exigencias legales. El relay solo guarda copias cifradas que no podemos abrir, y solo mientras compartes.',
          'Las leyes que te dan derechos sobre los datos de salud que una empresa tiene (por ejemplo, acceso o borrado) se aplican a nosotros de la forma más simple: no tenemos ninguno. Para borrar todo, usa Tú → Privacidad y datos → Borrar todo, y deja de compartir con tu pareja.',
        ],
      },
      {
        heading: 'Menores',
        body: [
          'Meztli es para personas de 13 años o más (16 o más en la UE, el Reino Unido y Canadá). No recibimos datos de nadie a sabiendas, incluidos menores.',
        ],
      },
      {
        heading: 'Cambios y contacto',
        body: [
          'Si esta política cambia de forma importante, la app te mostrará la nueva versión y te pedirá aceptarla de nuevo.',
          'Preguntas: abre un reporte en ' + SOURCE_URL + '/issues. El código es público, así que puedes comprobar cada afirmación tú misma.',
        ],
      },
    ],
  },
}

export function legalText(doc: LegalDoc, locale: Locale): LegalText {
  return (locale === 'es' ? es : en)[doc]
}

export const LEGAL_SETTING = 'legal.accepted'
