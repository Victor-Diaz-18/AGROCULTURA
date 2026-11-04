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
