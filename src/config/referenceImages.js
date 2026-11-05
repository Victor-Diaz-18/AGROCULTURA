import credits from '../assets/referencia/creditos.json'

/**
 * Photos that give an idea of what a story is about while it has none of its own, and that illustrate the public page.
 * All come from Wikimedia Commons with a free license; their authors are in creditos.json and in the page /creditos.
 * Each has a small version (kept for use with no signal) and a large one. They are never presented as photos of the story itself.
 */
const small = import.meta.glob('../assets/referencia/ref-*.webp', { eager: true, query: '?url', import: 'default' })
const large = import.meta.glob('../assets/referencia/big-*.webp', { eager: true, query: '?url', import: 'default' })

const ALT = {
  transporte: 'Foto antigua de un animal de carga en un camino de montaña en Colombia, hacia 1910',
  cafeto: 'Un cafeto cargado de hojas y frutos',
  cerezas: 'Rama de café con frutos verdes, amarillos y rojos, en Colombia',
  rama: 'Rama de café con frutos de distintos grados de madurez',
  fogon: 'Fogón de leña en una cocina tradicional de Santander, Colombia',
  secado: 'Café secándose al sol en un patio de cemento',
  charolas: 'Foto antigua de bandejas de madera para secar café',
  fiesta: 'Danzas tradicionales en una calle durante una fiesta en Colombia',
  roya: 'Una hoja de café con las manchas anaranjadas de la roya',
  mercado: 'Interior del mercado público de Santa Cruz de Lorica, Colombia',
  casa: 'Una casa antigua de hacienda entre árboles, en Colombia',
  tostado: 'Granos de café arábica tostados, de Minca',
  minca: 'Montañas cubiertas de bosque y cultivos en Minca',
  perico: 'Un perico de Santa Marta, verde con el pecho anaranjado, sobre una rama',
  nevados: 'Las cumbres nevadas de la Sierra Nevada detrás de montañas azules y nubes',
}

export const REFERENCE_IDS = Object.keys(ALT)

export function referenceImage(id) {
  return {
    id,
    small: small[`../assets/referencia/ref-${id}.webp`],
    large: large[`../assets/referencia/big-${id}.webp`],
    alt: ALT[id],
    credit: credits[id],
  }
}

/** Words in the title and tags of a story, and the image they call for. The first match wins, so the specific ones go first. */
const THEMES = [
  [/mula|arriero|camino/i, 'transporte'],
  [/roya|plaga|manchas/i, 'roya'],
  [/tostar|tostad|tueste/i, 'tostado'],
  [/fog[oó]n|cocina|receta|le[nñ]a/i, 'fogon'],
  [/patio|secad|secaba|beneficia/i, 'secado'],
  [/fiesta|baile|m[uú]sica|celebra/i, 'fiesta'],
  [/plaza|mercado|vend[ií]a|comprador|costal/i, 'mercado'],
  [/minga|cosecha|recolec|recoger/i, 'cerezas'],
  [/abuel|familia|casa|hogar|escuela|finca/i, 'casa'],
  [/paisaje|monta[nñ]a|sierra|nevad/i, 'minca'],
]

/** The image that best fits a story: by its title first, which says the most, then by its tags. */
export function referenceImageFor(story) {
  const fromTitle = THEMES.find(([words]) => words.test(story.titulo ?? ''))
  const fromTags = THEMES.find(([words]) => words.test((story.etiquetas ?? []).join(' ')))
  return referenceImage((fromTitle ?? fromTags)?.[1] ?? 'rama')
}
