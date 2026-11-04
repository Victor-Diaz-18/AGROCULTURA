import { OTHER_PLACE } from '../config/constants.js'
import { SECTOR_RADIUS_KM, ZONE } from '../config/map.js'

/** Distance in km between two { lat, lon } points (haversine). */
export function distanceKm(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * The sector a point belongs to: the nearest one within SECTOR_RADIUS_KM, or null ("Otro lugar de la zona").
 * A sector whose point is not confirmed (`provisional`) only counts when someone chose that very sector.
 * A sector is { id, nombre, centro: { lat, lon }, provisional }.
 */
export function sectorAt(point, sectors, { includeProvisional = false } = {}) {
  let best = null
  let bestDistance = SECTOR_RADIUS_KM
  for (const sector of sectors) {
    if (sector.provisional && !includeProvisional) continue
    const distance = distanceKm(point, sector.centro)
    if (distance <= bestDistance) {
      best = sector
      bestDistance = distance
    }
  }
  return best
}

/** Is the point inside the zone of the project? */
export const inZone = ({ lat, lon }) => lat >= ZONE.south && lat <= ZONE.north && lon >= ZONE.west && lon <= ZONE.east

/**
 * Where a story happened, in words: the name its narrator gave to the place plus the sector it is in
 * ("Finca La Esperanza, La Tagua"), or just one of them, or "Otro lugar de la zona".
 */
export function placeLine(story, sectors) {
  const sector = sectors.find((item) => item.id === story.sector_id)?.nombre
  if (story.lugar_nombre) return sector ? `${story.lugar_nombre}, ${sector}` : story.lugar_nombre
  return sector ?? OTHER_PLACE
}

/** The name to show for a story's sector, or "Otro lugar de la zona" when it has none. */
export const placeName = (sectorId, sectors) => sectors.find((sector) => sector.id === sectorId)?.nombre ?? OTHER_PLACE

/** Is the story's point inside the map's view? `bounds` is { south, west, north, east }; no bounds means "everything". */
export function inBounds(bounds, story) {
  if (!bounds) return true
  return story.lat >= bounds.south && story.lat <= bounds.north && story.lon >= bounds.west && story.lon <= bounds.east
}

/** The points of a list of stories as [lat, lon] pairs (what Leaflet wants). */
export const pointsOf = (stories) => stories.map((story) => [story.lat, story.lon])

/** Opens a point in Google Maps (the official "Maps URLs", no key needed). */
export const googleMapsUrl = ({ lat, lon }) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`

/** Opens a point in Apple Maps (it opens the app on an iPhone or a Mac, and the web map elsewhere). */
export const appleMapsUrl = ({ lat, lon }, name = '') => `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(name || 'Historia')}`
