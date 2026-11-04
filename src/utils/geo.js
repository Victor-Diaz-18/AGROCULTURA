/** Distance in km between two { lat, lon } points (haversine). */
export function distanceKm(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** The sector whose center is closest to the point (a sector is { id, nombre, centro: { lat, lon } }). */
export function nearestSector(point, sectors) {
  let best = null
  let bestDistance = Infinity
  for (const sector of sectors) {
    const distance = distanceKm(point, sector.centro)
    if (distance < bestDistance) {
      best = sector
      bestDistance = distance
    }
  }
  return best
}

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
