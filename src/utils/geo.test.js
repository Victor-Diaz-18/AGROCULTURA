import { describe, expect, it } from 'vitest'
import { CONFIG } from '../test/fixtures.js'
import { appleMapsUrl, distanceKm, googleMapsUrl, inBounds, nearestSector, pointsOf } from './geo.js'

describe('distanceKm', () => {
  it('is zero for the same point and about 111 km per degree of latitude', () => {
    expect(distanceKm({ lat: 11, lon: -74 }, { lat: 11, lon: -74 })).toBe(0)
    expect(distanceKm({ lat: 11, lon: -74 }, { lat: 12, lon: -74 })).toBeCloseTo(111.2, 0)
  })
})

describe('nearestSector', () => {
  it('picks the sector whose center is closest', () => {
    expect(nearestSector({ lat: 11.1305, lon: -74.09 }, CONFIG.sectores).id).toBe('la-tagua')
    expect(nearestSector({ lat: 11.11, lon: -74.15 }, CONFIG.sectores).id).toBe('san-lorenzo')
    expect(nearestSector({ lat: 11.14, lon: -74.12 }, CONFIG.sectores).id).toBe('minca')
  })

  it('returns null when there are no sectors', () => {
    expect(nearestSector({ lat: 11, lon: -74 }, [])).toBeNull()
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
