/**
 * The years a story happened, written by the person: the first one and, if it lasted, the last one.
 * The same rules as the server (lib/stories/schemas.py): from YEAR_MIN to this year, and the last one not before the first.
 * Stories told before this, with a fixed period, keep it; the server gives their years too (EPOCA_ANIOS in lib/stories/constants.py).
 */
export const YEAR_MIN = 1700

/** A year typed in a box: a whole number, or null when it is empty or is not one. */
export function parseYear(text) {
  const clean = String(text ?? '').trim()
  return /^\d{1,4}$/.test(clean) ? Number(clean) : null
}

/** What is wrong with these years, in plain words; '' when they make sense. `desde` is required, `hasta` is not. */
export function checkYears(desdeText, hastaText, now = new Date()) {
  const thisYear = now.getFullYear()
  const desde = parseYear(desdeText)
  const hasta = String(hastaText ?? '').trim() ? parseYear(hastaText) : desde
  if (!String(desdeText ?? '').trim()) return 'Escribe el año en que ocurrió.'
  if (desde === null || hasta === null) return 'Escribe el año con números, por ejemplo 1965.'
  if (desde < YEAR_MIN || desde > thisYear || hasta < YEAR_MIN || hasta > thisYear) return `Escribe un año entre ${YEAR_MIN} y ${thisYear}.`
  if (hasta < desde) return 'El año «hasta» no puede ser anterior al año «desde».'
  return ''
}

/** How the years read: «1955», or «1950 a 1960». */
export const yearsText = (desde, hasta) => (hasta == null || hasta === desde ? String(desde) : `${desde} a ${hasta}`)

/** What each period of before covers (the same as EPOCA_ANIOS on the server), for a map kept on the phone before the years. */
const EPOCA_YEARS = {
  'Antes de 1960': [null, 1959],
  '1960 a 1979': [1960, 1979],
  '1980 a 1999': [1980, 1999],
  '2000 en adelante': [2000, null],
}

/** The years of a story: [first, last], where null is "open" on that side. */
export function yearsOfStory(story) {
  if (story.anio_desde != null || story.anio_hasta != null) return [story.anio_desde ?? null, story.anio_hasta ?? story.anio_desde ?? null]
  return EPOCA_YEARS[story.epoca] ?? [null, null]
}

/** A year of the map's filter counts once it has its four digits: while it is being written nothing jumps. */
const filterYear = (text) => (/^\d{4}$/.test(String(text ?? '').trim()) ? Number(text) : null)

/**
 * Whether a story falls in the years a person is looking for: from, to, or both (written in either order).
 * A story that lasted counts when any of its years is in the range.
 */
export function inYears(story, desdeText, hastaText) {
  let from = filterYear(desdeText)
  let to = filterYear(hastaText)
  if (from === null && to === null) return true
  if (from !== null && to !== null && from > to) [from, to] = [to, from]
  const [first, last] = yearsOfStory(story)
  if (first === null && last === null) return false // a story with no years at all
  return (to === null || first === null || first <= to) && (from === null || last === null || last >= from)
}
