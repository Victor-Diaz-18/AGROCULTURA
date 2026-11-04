import { MAX_VIDEO_BYTES, VIDEO_TYPES } from '../config/constants.js'
import { isOnline } from '../offline/connectivity.js'
import { formatBytes } from '../utils/format.js'
import { newId } from '../utils/id.js'
import { ApiError, OfflineError, request } from './http.js'
import { attachVideo } from './stories.js'

/**
 * The video of a story (F13). It goes from the phone straight to Vercel Blob: a Vercel function takes about 4.5 MB per
 * request and a video can weigh 25 MB. The API only gives the permission (api/blob-token.js) and, once the video is
 * up, records it on the story. The story itself never waits for the video.
 */

const EXTENSION_OF = Object.fromEntries(Object.entries(VIDEO_TYPES).map(([extension, mime]) => [mime, extension]))

export const VIDEO_MESSAGES = {
  unreadable: (name) => `No pudimos leer «${name}». Usa un video MP4, MOV o WebM.`,
  tooBig: (bytes) => `Ese video pesa ${formatBytes(bytes)} y lo máximo es ${formatBytes(MAX_VIDEO_BYTES)}. Prueba con uno más corto.`,
  interrupted: 'No pudimos subir el video. Se intentará de nuevo.',
  unavailable: 'La subida de videos no está disponible en este momento.',
}

/** The type of a video file: what the browser says, or what its extension says (some phones say nothing). Null if none we accept. */
export function videoMime(file) {
  if (EXTENSION_OF[file.type]) return file.type
  const extension = /\.([A-Za-z0-9]+)$/.exec(file.name ?? '')?.[1].toLowerCase()
  return VIDEO_TYPES[extension] ?? null
}

/** { mime } for a video we can take, or { problem } in the person's words. */
export function checkVideoFile(file) {
  const mime = videoMime(file)
  if (!mime) return { problem: VIDEO_MESSAGES.unreadable(file.name) }
  if (file.size > MAX_VIDEO_BYTES) return { problem: VIDEO_MESSAGES.tooBig(file.size) }
  if (file.size === 0) return { problem: VIDEO_MESSAGES.unreadable(file.name) }
  return { mime }
}

/** What went wrong inside Blob's own upload, as one of our errors: no signal, or "try again later". */
function describeUploadFailure(error) {
  if (!isOnline()) return new OfflineError()
  if (error instanceof ApiError || error instanceof OfflineError) return error
  return new ApiError(503, VIDEO_MESSAGES.interrupted)
}

/**
 * Uploads the video straight to Blob and answers { tipo: 'video', url, mime, bytes }.
 * `video`: { blob, mime }. `userId` names the folder (the token only allows the person's own). `onProgress(percent)`.
 */
export async function uploadVideo(video, { userId, onProgress } = {}) {
  const mime = video.mime ?? videoMime(video.blob)
  const pathname = `historias/${userId}/video-${newId().slice(0, 12)}.${EXTENSION_OF[mime]}`

  let token
  try {
    token = (await request('/blob-token', { method: 'POST', body: { type: 'blob.generate-client-token', payload: { pathname, multipart: true, clientPayload: null } } })).clientToken
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new ApiError(503, VIDEO_MESSAGES.unavailable) // this way of running has no such function
    throw error
  }

  try {
    const { put } = await import('@vercel/blob/client') // only loaded when there is a video
    const result = await put(pathname, video.blob, {
      access: 'public',
      token,
      contentType: mime,
      multipart: true,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    })
    return { tipo: 'video', url: result.url, mime, bytes: video.blob.size }
  } catch (error) {
    throw describeUploadFailure(error)
  }
}

/**
 * Uploads the video (unless it already went up: `uploaded` remembers it) and adds it to the story `codigo`.
 * Throws like any request: OfflineError, or ApiError (a 5xx or 503 is worth trying again later, a 4xx is not).
 */
export async function sendVideo(codigo, video, { userId, uploaded = new WeakMap(), onUploaded, onProgress } = {}) {
  let medio = uploaded.get(video.blob)
  if (!medio) {
    medio = await uploadVideo(video, { userId, onProgress })
    uploaded.set(video.blob, medio)
    await onUploaded?.({ key: 'video' }, medio)
  }
  return attachVideo(codigo, medio)
}
