import { OTHER_PLACE } from '../config/constants.js'
import { hasLocation } from './geo.js'

/**
 * The filters of the map (F11): sector, origin, a search, period and format. Pure functions over the published stories
 * the map already has, so they work without signal and a new filter never needs the server.
 */

/** Sector: "todos", a sector id, or "otro" (a place outside every sector). Origin: todos | comunidad | proyecto. */
export const NO_FILTERS = { sector: 'todos', origen: 'todos', q: '', epoca: 'todas', formato: 'todos' }

export const OTHER_SECTOR = 'otro'

/** Lower case and without accents, so "cafe" finds "café" and "ARRIERIA" finds "arriería". */
export const plain = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export const isFiltering = (filters) => Object.keys(NO_FILTERS).some((key) => filters[key] !== NO_FILTERS[key])

/**
 * The words of a search must all be somewhere in the story's title, narrator, place, farm, period or tags.
 * A story with no place has no place to match: "otro lugar de la zona" is not a thing it says about itself.
 */
function matchesSearch(story, words, sectors) {
  if (words.length === 0) return true
  const sector = hasLocation(story) ? (sectors.find((item) => item.id === story.sector_id)?.nombre ?? OTHER_PLACE) : ''
  const haystack = plain(
    [story.titulo, story.narrador_nombre, story.lugar_nombre, story.finca_nombre, sector, story.epoca, ...(story.etiquetas ?? [])].join(' '),
  )
  return words.every((word) => haystack.includes(word))
}

/**
 * "Todos" shows every story, the ones with no place included. A sector shows the stories placed in it; "otro lugar" the ones
 * placed in none of them. A story with no place is in no sector (its reference is for the administrators), so only "Todos"
 * shows it.
 */
const inSector = (story, sector) =>
  sector === 'todos' ||
  (sector === OTHER_SECTOR ? hasLocation(story) && !story.sector_id : hasLocation(story) && story.sector_id === sector)

/** Every filter but the sector: what the counters of the sector tabs are counted over. */
export function applyOtherFilters(stories, filters, sectors = []) {
  const words = plain(filters.q).split(/\s+/).filter(Boolean)
  return stories.filter(
    (story) =>
      (filters.origen === 'todos' || story.origen === filters.origen) &&
      (filters.epoca === 'todas' || story.epoca === filters.epoca) &&
      (filters.formato === 'todos' || story.formatos.includes(filters.formato)) &&
      matchesSearch(story, words, sectors),
  )
}

export const applyFilters = (stories, filters, sectors = []) =>
  applyOtherFilters(stories, filters, sectors).filter((story) => inSector(story, filters.sector))

/** The tabs of the sectors with how many stories each one would show now. "Otro lugar" only when some story is there. */
export function sectorTabs(stories, filters, sectors) {
  const counted = applyOtherFilters(stories, filters, sectors)
  const tabs = [{ id: 'todos', label: 'Todos', count: counted.length }]
  for (const sector of sectors) {
    tabs.push({ id: sector.id, label: sector.nombre, count: counted.filter((story) => hasLocation(story) && story.sector_id === sector.id).length })
  }
  const inNoSector = (story) => hasLocation(story) && !story.sector_id
  if (stories.some(inNoSector)) {
    tabs.push({ id: OTHER_SECTOR, label: 'Otro lugar', count: counted.filter(inNoSector).length })
  }
  return tabs
}
