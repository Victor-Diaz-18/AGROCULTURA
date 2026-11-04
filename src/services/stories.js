import { request } from './http.js'

/**
 * Uploads one photo or audio (already compressed). Answers { tipo, url, mime, bytes, duracion_s }.
 * The file goes through the API, which keeps it in Vercel Blob: it must stay under about 3.5 MB.
 */
export function uploadMedia({ blob, tipo, name, duracion }) {
  const form = new FormData()
  form.append('tipo', tipo)
  form.append('archivo', blob, name)
  if (duracion != null) form.append('duracion_s', String(Math.round(duracion)))
  return request('/medios', { method: 'POST', body: form })
}

export const createStory = (payload) => request('/historias', { method: 'POST', body: payload })

export const fetchMyStories = () => request('/historias/mias')

/** Every published story, as the map needs it (public). */
export const fetchPublishedStories = () => request('/historias', { auth: false })

/** The card of a published story (public). */
export const fetchStory = (codigo) => request(`/historias/${encodeURIComponent(codigo)}`, { auth: false })

/** The body POST /api/historias expects, from what the person filled in and the uploaded files. */
export function buildStoryPayload(draft, medios) {
  return {
    client_id: draft.clientId,
    titulo: draft.titulo,
    texto: draft.texto,
    epoca: draft.epoca,
    etiquetas: draft.etiquetas,
    ubicacion: { lat: draft.location.lat, lon: draft.location.lon },
    ubicacion_origen: draft.location.origen,
    ...(draft.lugar ? { lugar_nombre: draft.lugar } : {}),
    medios: medios.map(({ tipo, url, mime, bytes, duracion_s: duracion }) => ({
      tipo,
      url,
      mime,
      bytes,
      ...(duracion != null ? { duracion_s: duracion } : {}),
    })),
  }
}

/**
 * Uploads the audio and the photos, then creates the story.
 * `uploaded` remembers files that already went up (keyed by their Blob), so if a later
 * step fails and the person taps "Enviar" again, nothing is uploaded twice.
 * `onProgress(done, total)` is called after each file; `onUploaded(file, medio)` after each file that really went up
 * (`file.key` is "audio" or the photo's id), so a story kept on the phone can remember it across page loads.
 */
export async function sendStory(draft, { uploaded = new WeakMap(), onProgress, onUploaded } = {}) {
  const files = []
  if (draft.audio) files.push({ key: 'audio', blob: draft.audio.blob, tipo: 'audio', name: 'audio.webm', duracion: draft.audio.seconds })
  for (const photo of draft.fotos) files.push({ key: photo.id, blob: photo.blob, tipo: 'foto', name: photo.name })

  const medios = []
  let done = 0
  for (const file of files) {
    let medio = uploaded.get(file.blob)
    if (!medio) {
      medio = await uploadMedia(file)
      uploaded.set(file.blob, medio)
      await onUploaded?.(file, medio)
    }
    medios.push(medio)
    done += 1
    onProgress?.(done, files.length)
  }
  return createStory(buildStoryPayload(draft, medios))
}
