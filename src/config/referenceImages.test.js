import { describe, expect, it } from 'vitest'
import { REFERENCE_IDS, referenceImage, referenceImageFor } from './referenceImages.js'

describe('imágenes de referencia', () => {
  it.each([
    ['El camino de mulas hasta Santa Marta', 'transporte'],
    ['La primera cosecha de la familia', 'cerezas'],
    ['El patio donde se secaba el café', 'secado'],
    ['Cuando llegó la roya', 'roya'],
    ['La fiesta de fin de cosecha', 'fiesta'],
    ['El fogón de leña de la casa', 'fogon'],
    ['Cómo aprendí a tostar café', 'tostado'],
    ['Cuando el café se vendía en la plaza', 'mercado'],
    ['Lo que contaban los abuelos en la finca', 'casa'],
  ])('«%s» muestra algo que tiene que ver con ella', (titulo, id) => {
    expect(referenceImageFor({ titulo, etiquetas: [] }).id).toBe(id)
  })

  it('uses the tags when the title says nothing, and a coffee branch when nothing does', () => {
    expect(referenceImageFor({ titulo: 'Un recuerdo', etiquetas: ['#cocina'] }).id).toBe('fogon')
    expect(referenceImageFor({ titulo: 'Un recuerdo' }).id).toBe('rama')
  })

  it('every image has its two sizes, a description and the credit its license asks for', () => {
    for (const id of REFERENCE_IDS) {
      const image = referenceImage(id)
      expect(image.small, id).toBeTruthy()
      expect(image.large, id).toBeTruthy()
      expect(image.alt, id).toBeTruthy()
      expect(image.credit.autor, id).toBeTruthy()
      expect(image.credit.licencia, id).toMatch(/CC|Public domain/)
      expect(image.credit.pagina, id).toContain('commons.wikimedia.org')
    }
  })
})
