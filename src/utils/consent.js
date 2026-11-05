import TEXTS from '../../lib/stories/consentimiento.json'

/**
 * The authorization a narrator gives to publish a story (and the team, for its own stories).
 *
 * The texts and their version are in lib/stories/consentimiento.json, the very file the server reads: what is on the screen
 * is what the server has a version of. They travel inside the app, so they are there without signal. When the words change,
 * the version changes, and a phone that still has the old app is told to update when it sends (the server refuses the old one).
 */

export const CONSENT_VERSION = TEXTS.version

/** The choices that decide which text applies: `anonima` (publish without the name) and `modo` ("aproximada" | "ninguna"). */
export const consentVariant = ({ anonima, modo }) => `${modo}_${anonima ? 'sin' : 'con'}_nombre`

/** { texto, aviso } of the text for those choices. `who`: "narrador" (own story) or "equipo" (a story the team uploads). */
export const consentText = ({ anonima, modo }, who = 'narrador') => TEXTS[who][consentVariant({ anonima, modo })]

/**
 * The text a story was published under, from the record kept with it ({ version, variante, de, aceptado_en }); null when the
 * record is of another version of the words (the team then sees the version and the date, not words that were never shown).
 */
export const consentTextOf = (record) => (record && record.version === CONSENT_VERSION ? (TEXTS[record.de]?.[record.variante] ?? null) : null)

/** What is kept in the draft when the box is ticked: the text it was ticked for and when. */
export const acceptConsent = ({ anonima, modo }, now = new Date()) => ({
  version: CONSENT_VERSION,
  variante: consentVariant({ anonima, modo }),
  aceptadoEn: now.toISOString(),
})

/**
 * Is that acceptance still valid for the choices now? It was given for one text: if the person changed what the text says
 * (the name, the place) afterwards, the box is no longer ticked and must be ticked again.
 */
export const isAccepted = (consent, { anonima, modo }) =>
  Boolean(consent) && consent.version === CONSENT_VERSION && consent.variante === consentVariant({ anonima, modo })

/** The `consentimiento` the API expects, from what the draft kept. */
export const consentPayload = (consent) => ({ aceptado: true, version: consent.version, aceptado_en: consent.aceptadoEn })
