import { describe, expect, it } from 'vitest'
import { CONFIG } from '../test/fixtures.js'
import { distanceKm, nearestSector } from './geo.js'

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
