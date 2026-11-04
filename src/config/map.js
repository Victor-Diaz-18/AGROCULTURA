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

/** The names of the sectors help to find one's way when the map is far; zoomed in, the map's own place names take over. */
export const SECTOR_LABELS_MAX_ZOOM = 12

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
