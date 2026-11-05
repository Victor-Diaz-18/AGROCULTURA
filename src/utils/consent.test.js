import { describe, expect, it } from 'vitest'
import { CONSENT_VERSION, acceptConsent, consentPayload, consentText, consentVariant, isAccepted } from './consent.js'

const NAME_AND_PLACE = { anonima: false, modo: 'aproximada' }

describe('the authorization to publish', () => {
  it('has one text for each combination of name and place, in plain words', () => {
    expect(consentText({ anonima: false, modo: 'aproximada' }).texto).toBe(
      'Autorizo que mi historia se publique con mi nombre y con un lugar aproximado en el mapa (a unos 500 metros).',
    )
    expect(consentText({ anonima: true, modo: 'aproximada' }).texto).toContain('sin mi nombre')
    expect(consentText({ anonima: true, modo: 'aproximada' }).texto).toContain('«Narrador anónimo»')
    expect(consentText({ anonima: false, modo: 'ninguna' }).texto).toContain('con mi nombre y sin ubicación en el mapa')
    expect(consentText({ anonima: true, modo: 'ninguna' }).texto).toContain('sin mi nombre')
    expect(consentText({ anonima: true, modo: 'ninguna' }).texto).toContain('sin ubicación')
    const texts = [false, true].flatMap((anonima) => ['aproximada', 'ninguna'].map((modo) => consentText({ anonima, modo }).texto))
    expect(new Set(texts).size).toBe(4)
  })

  it('has its own texts for the team, which says it has the authorization of whoever tells the story', () => {
    expect(consentText(NAME_AND_PLACE, 'equipo').texto).toMatch(/^Tengo la autorización de quien cuenta la historia/)
  })

  it('tells what the team sees, in the text of the narrator that is on the screen', () => {
    expect(consentText({ anonima: false, modo: 'aproximada' }).aviso).toContain('el lugar exacto')
    expect(consentText({ anonima: false, modo: 'ninguna' }).aviso).toContain('lugar de referencia')
  })

  it('names the variant the server stores (the same four names)', () => {
    expect(consentVariant({ anonima: false, modo: 'aproximada' })).toBe('aproximada_con_nombre')
    expect(consentVariant({ anonima: true, modo: 'aproximada' })).toBe('aproximada_sin_nombre')
    expect(consentVariant({ anonima: false, modo: 'ninguna' })).toBe('ninguna_con_nombre')
    expect(consentVariant({ anonima: true, modo: 'ninguna' })).toBe('ninguna_sin_nombre')
  })

  it('carries the version of the text, the one the server checks when a story arrives', () => {
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d+$/)
  })

  it('keeps what was accepted: the version, the text and the moment', () => {
    const accepted = acceptConsent(NAME_AND_PLACE, new Date('2026-11-04T10:00:00Z'))

    expect(accepted).toEqual({ version: CONSENT_VERSION, variante: 'aproximada_con_nombre', aceptadoEn: '2026-11-04T10:00:00.000Z' })
    expect(consentPayload(accepted)).toEqual({ aceptado: true, version: CONSENT_VERSION, aceptado_en: '2026-11-04T10:00:00.000Z' })
  })

  it('is only valid for the text it was ticked for: changing the name or the place asks again', () => {
    const accepted = acceptConsent(NAME_AND_PLACE)

    expect(isAccepted(accepted, NAME_AND_PLACE)).toBe(true)
    expect(isAccepted(accepted, { anonima: true, modo: 'aproximada' })).toBe(false)
    expect(isAccepted(accepted, { anonima: false, modo: 'ninguna' })).toBe(false)
    expect(isAccepted(null, NAME_AND_PLACE)).toBe(false)
    expect(isAccepted({ ...accepted, version: 'otra-version' }, NAME_AND_PLACE)).toBe(false)
  })
})
