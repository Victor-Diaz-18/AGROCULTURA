/**
 * Map settings in one place.
 * The tile provider is a single constant so it can be swapped later for a terrain
 * map (MapTiler, Stadia...) without touching any component.
 */

export const TILE_PROVIDER = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  maxZoom: 18,
  // Tiles are requested with CORS so the service worker can keep the ones already seen (F10) without the browser counting
  // each as several MB of storage (that is what an opaque answer costs). The provider must send Access-Control-Allow-Origin.
  crossOrigin: true,
}

/** Minca (Sierra Nevada de Santa Marta). Used until the sectors load. */
export const DEFAULT_CENTER = [11.13, -74.11]
export const DEFAULT_ZOOM = 12

/** How far people can zoom: the area of interest is small. */
export const ZOOM_LIMITS = { min: 9, max: 17 }

/**
 * A sector's name is written on the map the way a map writes a village: only once one is close enough (this level or
 * more: the view is then about 15 km wide, a sector and its surroundings) and only for the sectors that are in view.
 * Far away they would be four names piled on one point.
 */
export const SECTOR_LABELS_MIN_ZOOM = 13

/**
 * The zone of the project: "Minca y sectores aledaños". A story can be placed anywhere inside it (the sectors are
 * only references); the form does not let the pin go outside. About 90 km wide, around Minca.
 */
export const ZONE = { south: 10.74, west: -74.52, north: 11.54, east: -73.72 }

/**
 * A story belongs to a sector when its point is within this distance of the sector's center, and to none otherwise
 * ("Otro lugar de la zona"). The server decides in the end with the same number (SECTOR_RADIUS_KM in lib/catalog).
 */
export const SECTOR_RADIUS_KM = 3
