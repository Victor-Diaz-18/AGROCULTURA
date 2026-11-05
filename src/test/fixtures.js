import { EMPTY_STATS } from '../config/constants.js'
import { CONSENT_VERSION } from '../utils/consent.js'

export const CONFIG = {
  portal: { nombre: 'AGROCULTURA', avisar_rechazo: false, datos_de_ejemplo: true, reinicio_disponible: false },
  sectores: [
    { id: 'minca', nombre: 'Minca', centro: { lat: 11.14, lon: -74.118 }, provisional: false },
    { id: 'la-tagua', nombre: 'La Tagua', centro: { lat: 11.082986, lon: -74.044951 }, provisional: false },
    { id: 'san-lorenzo', nombre: 'San Lorenzo', centro: { lat: 11.116315, lon: -74.034676 }, provisional: false },
    { id: 'tijereras', nombre: 'Tijereras', centro: { lat: 11.109, lon: -74.1108 }, provisional: true },
  ],
  etiquetas: ['#café', '#finca', '#familia', '#cosecha', '#cocina', '#oficios'],
  epocas: ['Antes de 1960', '1960 a 1979', '1980 a 1999', '2000 en adelante'],
  motivos_rechazo: [
    { id: 'fuera-del-tema', etiqueta: 'Fuera del tema', texto: 'Fuera del tema: no trata de la cultura cafetera' },
    { id: 'contenido-incompleto', etiqueta: 'Contenido incompleto', texto: 'Contenido incompleto o no se entiende' },
  ],
}

export const STATS = { ...EMPTY_STATS }

/** A story as /api/admin/historias answers it. */
export const adminStory = (overrides = {}) => ({
  codigo: 'HIS-2026-008',
  titulo: 'El beneficiadero comunitario',
  texto: 'Entre varias familias armamos un beneficiadero para lavar y secar el café de todos.',
  narrador_nombre: 'Jorge Iván Castro',
  sector_id: 'la-tagua',
  epoca: '2000 en adelante',
  etiquetas: ['#café', '#oficios'],
  formatos: ['Texto'],
  medios: [],
  estado: 'revision',
  origen: 'comunidad',
  ejemplo: false,
  motivo_rechazo: null,
  lat: 11.1,
  lon: -74.05,
  anonima: false,
  ubicacion_modo: 'aproximada',
  finca_nombre: null,
  consentimiento: { version: CONSENT_VERSION, variante: 'aproximada_con_nombre', de: 'narrador', aceptado_en: '2026-10-18T11:58:00Z' },
  enviada_en: '2026-10-18T12:00:00Z',
  revisada_en: '',
  publicada_en: '',
  ...overrides,
})

/** A published story as the map list (/api/historias) answers it. Minca center unless told otherwise. */
export const mapStory = (overrides = {}) => ({
  codigo: 'HIS-2026-001',
  titulo: 'El camino de mulas hasta Santa Marta',
  narrador_nombre: 'Aurelio Martínez',
  sector_id: 'minca',
  epoca: 'Antes de 1960',
  formatos: ['Audio', 'Foto'],
  origen: 'comunidad',
  lat: 11.14,
  lon: -74.118,
  foto_url: null,
  etiquetas: ['#café', '#finca'],
  publicada_en: '2026-09-14T12:00:00Z',
  ...overrides,
})

/** A published story that has no place on the map, as the public gets it: no point, no sector, no place name. */
export const storyWithoutPlace = (overrides = {}) =>
  mapStory({
    codigo: 'HIS-2026-040',
    titulo: 'Lo que contaba mi abuela',
    sector_id: null,
    lugar_nombre: null,
    lat: null,
    lon: null,
    con_ubicacion: false,
    aproximada: false,
    ...overrides,
  })

/** The card of a published story (/api/historias/{codigo}). */
export const storyCard = (overrides = {}) => ({
  ...mapStory(),
  texto: 'Antes de que hubiera carretera, el café bajaba en mula por el camino viejo.',
  etiquetas: ['#café', '#oficios'],
  medios: [],
  ...overrides,
})

/** A story kept on the phone for the signal to return (what offline/store.js keeps in the queue). */
export const queuedDraft = (overrides = {}) => ({
  clientId: 'queued-0001',
  narratorId: 'u1',
  guardadoEn: '2026-11-04T10:00:00.000Z',
  titulo: 'El camino de mulas',
  texto: 'Antes de que hubiera carretera, el café bajaba en mula.',
  epoca: 'Antes de 1960',
  location: { lat: 11.14, lon: -74.118, origen: 'sector', sectorId: 'minca' },
  lugar: '',
  lugarTexto: 'Minca',
  etiquetas: ['#café'],
  formatos: ['Texto'],
  audio: null,
  fotos: [],
  subidos: {},
  fallo: null,
  ...overrides,
})
