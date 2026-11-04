import { EMPTY_STATS } from '../config/constants.js'

export const CONFIG = {
  portal: { nombre: 'AGROCULTURA', avisar_rechazo: false, datos_de_ejemplo: true, reinicio_disponible: false },
  sectores: [
    { id: 'minca', nombre: 'Minca', centro: { lat: 11.14, lon: -74.118 } },
    { id: 'la-tagua', nombre: 'La Tagua', centro: { lat: 11.13, lon: -74.087 } },
    { id: 'san-lorenzo', nombre: 'San Lorenzo', centro: { lat: 11.1245, lon: -74.154 } },
    { id: 'tijereras', nombre: 'Tijereras', centro: { lat: 11.109, lon: -74.111 } },
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
  publicada_en: '2026-09-14T12:00:00Z',
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
