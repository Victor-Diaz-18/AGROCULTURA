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
 * THE area the map for choosing a place covers: the only constant to change to widen or narrow it. A story can be placed anywhere
 * inside it (the sectors are only names of reference, never a boundary); the map cannot be moved out of it and a point outside is
 * not accepted. Whoever is further away can still tell a story with «Sin ubicación».
 *
 * It covers the Magdalena side of the Sierra Nevada de Santa Marta with room to spare, not only the surroundings of Minca:
 *  - north 11.50: the Caribbean coast (Santa Marta, Minca and Tayrona are around 11.1 to 11.3);
 *  - south 10.15: below the foot of the sierra (Aracataca is at 10.59, Fundación at 10.52, Pueblo Bello at 10.42);
 *  - west -74.70: the whole Ciénaga Grande de Santa Marta and the banana plain (Ciénaga is at -74.25);
 *  - east -73.20: beyond the crest (Pico Cristóbal Colón is at -73.69) and the coast of Palomino (-73.57).
 * About 150 km from north to south by 164 km from east to west (some 24,600 km², about one and a half times the area of the
 * massif). A rectangle because that is what the map takes (its limits) and what a point is checked against.
 */
export const ZONE = { south: 10.15, west: -74.7, north: 11.5, east: -73.2 }

/**
 * A story belongs to a sector when its point is within this distance of the sector's center, and to none otherwise
 * ("Otro lugar de la zona"). The server decides in the end with the same number (SECTOR_RADIUS_KM in lib/catalog).
 */
export const SECTOR_RADIUS_KM = 3
