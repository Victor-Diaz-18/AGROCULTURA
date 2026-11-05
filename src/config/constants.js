/** Fixed vocabulary of the app. The server serves the same lists in /api/config. */

export const EPOCAS = ['Antes de 1960', '1960 a 1979', '1980 a 1999', '2000 en adelante']

/** What the administrator confirms before approving a story. The ids are the ones the server asks for. */
export const COMPROBACIONES = [
  { id: 'tema', texto: 'Trata de la cultura cafetera.' },
  { id: 'territorio', texto: 'Ocurrió en Minca o en un sector aledaño.' },
  { id: 'datos', texto: 'No expone datos personales de otras personas.' },
]

/** The most an upload may weigh (a Vercel function takes about 4.5 MB per request): same as lib/media/validation.py. */
export const MAX_UPLOAD_BYTES = 3_500_000

/** The most a video may weigh: 25 MB, counted as phones and `formatBytes` do (millions of bytes). Same as api/_lib/video.js and lib/media/validation.py. */
export const MAX_VIDEO_BYTES = 25_000_000

/** The video types we accept, by file extension (an iPhone records .mov, most others .mp4). */
export const VIDEO_TYPES = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' }

/** Applied when the narrator picks no tag, as in the approved design. */
export const DEFAULT_TAG = '#café'

/** Same limits the server enforces (lib/stories/schemas.py): the form stops the person before the server has to. */
export const MAX_PLACE_NAME = 80

export const LIMITS = { tituloMin: 3, tituloMax: 120, textoMax: 5000, fotos: 6, etiquetas: 6 }

/** What the public reads where the name of a narrator who asked not to be named would be. The server writes it; this is for the one place the app has to tell it apart. */
export const NARRADOR_ANONIMO = 'Narrador anónimo'

/** What the list and the card say of a story published without a place on the map (nothing about where it is is public). */
export const NO_LOCATION = 'Sin ubicación en el mapa'

/** What a story is said to be in when its point is far from every sector (the zone is wider than the four sectors). */
export const OTHER_PLACE = 'Otro lugar de la zona'

/** Labels and colors of each story state. The narrator sees "No publicada" for a rejected story. */
export const ESTADOS = {
  borrador: { label: 'Borrador', labelAdmin: 'Borrador', sigue: 'Se envía cuando haya señal' },
  revision: { label: 'En revisión', labelAdmin: 'En revisión', sigue: 'Lo revisa un administrador' },
  publicada: { label: 'Publicada', labelAdmin: 'Publicada', sigue: 'Ya está en el mapa' },
  rechazada: { label: 'No publicada', labelAdmin: 'Rechazada', sigue: '' },
}

/** Used until /api/config answers (or when the very first visit has no connection). */
export const FALLBACK_CONFIG = {
  portal: { nombre: 'AGROCULTURA', avisar_rechazo: false, datos_de_ejemplo: false },
  sectores: [],
  etiquetas: [],
  epocas: EPOCAS,
  motivos_rechazo: [],
}

export const EMPTY_STATS = {
  publicadas: 0,
  en_revision: 0,
  rechazadas: 0,
  aprobadas_comunidad: 0,
  por_origen: { comunidad: 0, proyecto: 0 },
  sectores_con_historias: 0,
  total_sectores: 4,
  sin_ubicacion: 0,
  formatos: { foto: 0, audio: 0, video: 0 },
}
