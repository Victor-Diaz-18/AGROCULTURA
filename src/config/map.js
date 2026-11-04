/**
 * Map settings in one place.
 * The tile provider is a single constant so it can be swapped later for a terrain
 * map (MapTiler, Stadia...) without touching any component.
 */

export const TILE_PROVIDER = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  maxZoom: 18,
}

/** Minca (Sierra Nevada de Santa Marta). Used until the sectors load. */
export const DEFAULT_CENTER = [11.13, -74.11]
export const DEFAULT_ZOOM = 12

/** How far people can zoom: the area of interest is small. */
export const ZOOM_LIMITS = { min: 9, max: 17 }
