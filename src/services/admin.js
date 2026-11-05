import { request } from './http.js'
import { buildStoryPayload, uploadMedia } from './stories.js'
import { uploadVideo } from './video.js'

/** Everything here needs an administrator session. */

const query = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== ''))
  return search.size > 0 ? `?${search}` : ''
}

/** Stories with all their content. `estado`: revision | publicada | rechazada. `origen`: comunidad | proyecto. */
export const fetchAdminStories = ({ estado, origen, limite } = {}) => request(`/admin/historias${query({ estado, origen, limite })}`)

/** Publishes a story that waited for review. `confirmaciones`: the checks marked ("tema", "territorio", "datos", "consentimiento"). */
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
 * Uploads the audio and photos (through the API) and the video (straight to Blob), then publishes the team's story.
 * `uploaded` remembers what already went up, so a retry does not upload it again. `userId` is the administrator's: the
 * video goes to their folder. `onProgress(percent)` follows the video. Unlike a narrator's story, a team story is not
 * published without its video: whoever uploads it is looking at the screen and can try again.
 */
export async function publishProjectStory(draft, { uploaded = new WeakMap(), userId, onProgress } = {}) {
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
  if (draft.video) {
    let medio = uploaded.get(draft.video.blob)
    if (!medio) {
      medio = await uploadVideo(draft.video, { userId, onProgress })
      uploaded.set(draft.video.blob, medio)
    }
    medios.push(medio)
  }
  // The same options as a narrator's story (place, name, farm, authorization), plus who tells it.
  return createProjectStory({ ...buildStoryPayload(draft, medios), narrador_nombre: draft.narrador || undefined })
}
