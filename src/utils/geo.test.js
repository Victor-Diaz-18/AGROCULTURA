import { describe, expect, it } from 'vitest'
import { CONFIG } from '../test/fixtures.js'
import { appleMapsUrl, distanceKm, googleMapsUrl, inBounds, inZone, placeLine, placeName, pointsOf, sectorAt } from './geo.js'

describe('distanceKm', () => {
  it('is zero for the same point and about 111 km per degree of latitude', () => {
    expect(distanceKm({ lat: 11, lon: -74 }, { lat: 11, lon: -74 })).toBe(0)
    expect(distanceKm({ lat: 11, lon: -74 }, { lat: 12, lon: -74 })).toBeCloseTo(111.2, 0)
  })
})

describe('sectorAt', () => {
  const at = (lat, lon, options) => sectorAt({ lat, lon }, CONFIG.sectores, options)?.id ?? null

  it('is the sector whose center is closest, when the point is near it', () => {
    expect(at(11.0835, -74.045)).toBe('la-tagua')
    expect(at(11.1165, -74.035)).toBe('san-lorenzo')
    expect(at(11.14, -74.12)).toBe('minca')
  })

  it('is none for a point far from every sector: the story is "another place of the zone"', () => {
    expect(at(11.2, -73.95)).toBeNull()
    expect(at(11.3, -74.3)).toBeNull()
  })

  it('takes the nearest one when two are within reach', () => {
    expect(at(11.1105, -74.0355)).toBe('san-lorenzo')
    expect(at(11.0905, -74.0445)).toBe('la-tagua')
  })

  it('does not count a sector whose point is not confirmed, unless it was chosen itself', () => {
    expect(at(11.111, -74.1108)).toBeNull() // right beside Tijereras
    expect(at(11.109, -74.1108, { includeProvisional: true })).toBe('tijereras')
  })

  it('is none when there are no sectors', () => {
    expect(sectorAt({ lat: 11, lon: -74 }, [])).toBeNull()
  })
})

describe('inZone', () => {
  it('includes Minca, the sectors and the places around them', () => {
    for (const sector of CONFIG.sectores) expect(inZone(sector.centro)).toBe(true)
    expect(inZone({ lat: 11.24, lon: -74.2 })).toBe(true) // Santa Marta
  })

  it('leaves out what is far away', () => {
    expect(inZone({ lat: 4.7, lon: -74.07 })).toBe(false) // Bogotá
    expect(inZone({ lat: 0, lon: 0 })).toBe(false)
    expect(inZone({ lat: 11.14, lon: -72 })).toBe(false)
  })
})

describe('placeName', () => {
  it('is the name of the sector, or "Otro lugar de la zona" when there is none', () => {
    expect(placeName('la-tagua', CONFIG.sectores)).toBe('La Tagua')
    expect(placeName(null, CONFIG.sectores)).toBe('Otro lugar de la zona')
    expect(placeName('desaparecido', CONFIG.sectores)).toBe('Otro lugar de la zona')
  })
})

describe('placeLine', () => {
  it('puts the name given to the place before its sector', () => {
    expect(placeLine({ sector_id: 'la-tagua', lugar_nombre: 'Finca La Esperanza' }, CONFIG.sectores)).toBe('Finca La Esperanza, La Tagua')
  })

  it('is the name alone when the place has no sector', () => {
    expect(placeLine({ sector_id: null, lugar_nombre: 'Finca La Esperanza' }, CONFIG.sectores)).toBe('Finca La Esperanza')
  })

  it('is the sector, or "Otro lugar de la zona", when the place has no name', () => {
    expect(placeLine({ sector_id: 'minca', lugar_nombre: null }, CONFIG.sectores)).toBe('Minca')
    expect(placeLine({ sector_id: null }, CONFIG.sectores)).toBe('Otro lugar de la zona')
  })
})

describe('inBounds', () => {
  const view = { south: 11.1, west: -74.2, north: 11.2, east: -74.0 }

  it('is true for a story inside the view, edges included', () => {
    expect(inBounds(view, { lat: 11.15, lon: -74.1 })).toBe(true)
    expect(inBounds(view, { lat: 11.1, lon: -74.2 })).toBe(true)
    expect(inBounds(view, { lat: 11.2, lon: -74.0 })).toBe(true)
  })

  it('is false for a story outside the view on any side', () => {
    expect(inBounds(view, { lat: 11.3, lon: -74.1 })).toBe(false)
    expect(inBounds(view, { lat: 11.0, lon: -74.1 })).toBe(false)
    expect(inBounds(view, { lat: 11.15, lon: -74.3 })).toBe(false)
    expect(inBounds(view, { lat: 11.15, lon: -73.9 })).toBe(false)
  })

  it('shows everything when the view is not known (a map that has no size yet)', () => {
    expect(inBounds(null, { lat: 0, lon: 0 })).toBe(true)
  })
})

describe('pointsOf', () => {
  it('gives [lat, lon] pairs', () => {
    expect(pointsOf([{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }])).toEqual([[1, 2], [3, 4]])
  })
})

describe('links to other maps', () => {
  it('opens a point in Google Maps with the official URL', () => {
    expect(googleMapsUrl({ lat: 11.0829, lon: -74.045 })).toBe('https://www.google.com/maps/search/?api=1&query=11.0829,-74.045')
  })

  it('opens a point in Apple Maps, with the name of the story written safely', () => {
    expect(appleMapsUrl({ lat: 11.1, lon: -74.2 }, 'Café & trilla #1')).toBe('https://maps.apple.com/?ll=11.1,-74.2&q=Caf%C3%A9%20%26%20trilla%20%231')
  })

  it('has a name for a story that has none', () => {
    expect(appleMapsUrl({ lat: 1, lon: 2 })).toBe('https://maps.apple.com/?ll=1,2&q=Historia')
  })
})
