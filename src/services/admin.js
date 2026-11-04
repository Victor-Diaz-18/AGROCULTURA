import { request } from './http.js'
import { uploadMedia } from './stories.js'

/** Everything here needs an administrator session. */

const query = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== ''))
  return search.size > 0 ? `?${search}` : ''
}

/** Stories with all their content. `estado`: revision | publicada | rechazada. `origen`: comunidad | proyecto. */
export const fetchAdminStories = ({ estado, origen, limite } = {}) => request(`/admin/historias${query({ estado, origen, limite })}`)

/** Publishes a story that waited for review. `confirmaciones`: the checks marked ("tema", "territorio", "datos"). */
export const approveStory = (codigo, confirmaciones) =>
  request(`/admin/historias/${encodeURIComponent(codigo)}/aprobar`, { method: 'POST', body: { confirmaciones } })

/** `motivo` is the id of one of the rejection reasons in /config. */
export const rejectStory = (codigo, motivo) =>
  request(`/admin/historias/${encodeURIComponent(codigo)}/rechazar`, { method: 'POST', body: { motivo } })

export const updatePortal = (changes) => request('/admin/portal', { method: 'PATCH', body: changes })

export const addTag = (nombre) => request('/admin/etiquetas', { method: 'POST', body: { nombre } })

export const removeTag = (nombre) => request(`/admin/etiquetas${query({ nombre })}`, { method: 'DELETE' })

/** Deletes EVERY story and loads the examples. Only works when the server allows it. */
export const resetDemoData = () => request('/admin/reiniciar-ejemplo', { method: 'POST', body: { confirmar: true } })

export const createProjectStory = (payload) => request('/admin/historias-proyecto', { method: 'POST', body: payload })

/**
 * Uploads the audio and photos, then publishes the team's story.
 * `uploaded` remembers what already went up, so a retry does not upload it again.
 */
export async function publishProjectStory(draft, { uploaded = new WeakMap() } = {}) {
  const files = []
  if (draft.audio) files.push({ blob: draft.audio.blob, tipo: 'audio', name: draft.audio.name, duracion: draft.audio.seconds })
  for (const photo of draft.fotos) files.push({ blob: photo.blob, tipo: 'foto', name: photo.name })

  const medios = []
  for (const file of files) {
    let medio = uploaded.get(file.blob)
    if (!medio) {
      medio = await uploadMedia(file)
      uploaded.set(file.blob, medio)
    }
    medios.push(medio)
  }
  return createProjectStory({
    client_id: draft.clientId,
    titulo: draft.titulo,
    texto: draft.texto,
    epoca: draft.epoca,
    ubicacion: { lat: draft.location.lat, lon: draft.location.lon },
    ubicacion_origen: draft.location.origen,
    etiquetas: draft.etiquetas,
    narrador_nombre: draft.narrador || undefined,
    medios: medios.map(({ tipo, url, mime, bytes, duracion_s: duracion }) => ({
      tipo,
      url,
      mime,
      bytes,
      ...(duracion != null ? { duracion_s: duracion } : {}),
    })),
  })
}
