/**
 * Sends the stories that were kept on the phone because there was no signal (F10), and the videos that go after them (F13).
 *
 * Safe to run any number of times: each story keeps the same `clientId`, so the server answers with the story it
 * already has instead of making a copy, and the files that already went up are not uploaded again.
 *
 * A waiting item is in one of two phases:
 *  - the story (no `fase`): text, audio and photos still have to go;
 *  - `fase: 'video'`: the story is already on the server (`codigo`) and only its video is left. The video goes after
 *    the story because it can take long over a bad connection: the story never waits for it.
 */

import { ApiError, OfflineError } from '../services/http.js'
import { sendStory } from '../services/stories.js'
import { sendVideo } from '../services/video.js'
import { getQueued, listQueued, removeQueued, updateQueued } from './store.js'

/** Why a round stopped before the end. In every case the stories that were not sent stay on the phone. */
export const STOPPED = {
  offline: 'offline', // the signal went away again
  auth: 'auth', // the session expired: the person has to sign in again
  server: 'server', // the server is having trouble: worth trying again in a while
}

const FAILED_MESSAGE = 'No pudimos enviar esta historia.'
const VIDEO_FAILED_MESSAGE = 'No pudimos subir el video. Revisa tu conexión y toca «Reintentar».'

/** After this many failed rounds a video stops being retried by itself: it says so and waits for the person. */
export const MAX_VIDEO_ATTEMPTS = 5

/** A problem that may go away by itself: the server's, not the story's. */
const isServerTrouble = (error) => error instanceof ApiError && (error.status >= 500 || error.status === 408 || error.status === 429)

/** The files of this story that already went up in an earlier attempt, so they are not sent twice. */
function alreadyUploaded(item) {
  const uploaded = new WeakMap()
  if (item.audio && item.subidos?.audio) uploaded.set(item.audio.blob, item.subidos.audio)
  for (const photo of item.fotos) if (item.subidos?.[photo.id]) uploaded.set(photo.blob, item.subidos[photo.id])
  if (item.video && item.subidos?.video) uploaded.set(item.video.blob, item.subidos.video)
  return uploaded
}

/** How a failure stops (or does not stop) the round: one of STOPPED, or null for a story the server refused for good. */
function stopFor(error) {
  if (error instanceof OfflineError) return STOPPED.offline
  if (error instanceof ApiError && error.status === 401) return STOPPED.auth
  if (isServerTrouble(error)) return STOPPED.server
  return null
}

/** Remembers each file as it goes up, so a later failure does not repeat the upload. A courtesy: never fails the send. */
function rememberUploads(item, subidos) {
  return async ({ key }, medio) => {
    subidos[key] = medio
    await updateQueued(item.clientId, { subidos }).catch(() => {})
  }
}

/**
 * One round over the waiting items of a narrator, oldest first.
 * Answers { sent, videos, failed, stopped }: `sent` are stories that reached the server, `videos` the videos that were
 * added to theirs, `failed` the ones the server refused for good (they keep their reason and wait for the person), and
 * `stopped` is one of STOPPED or null. `onVideoProgress(clientId, percent)` follows a video that is going up.
 */
export async function flushQueue(narratorId, { send = sendStory, sendVideoFile = sendVideo, onVideoProgress } = {}) {
  const sent = []
  const videos = []
  const failed = []
  let stopped = null

  for (const summary of await listQueued(narratorId)) {
    if (summary.fallo) continue // refused earlier: waits until the person asks to try again
    let item = await getQueued(summary.clientId)
    if (!item) continue // another tab sent it meanwhile
    const subidos = { ...item.subidos }

    // Phase 1: the story itself.
    if (item.fase !== 'video') {
      try {
        const story = await send(item, { uploaded: alreadyUploaded(item), onUploaded: rememberUploads(item, subidos) })
        sent.push(summary)
        if (!item.video) {
          await removeQueued(item.clientId)
          continue
        }
        // The story is in. What is left is the video: keep only that (and where the story is).
        await updateQueued(item.clientId, { fase: 'video', codigo: story.codigo, audio: null, fotos: [], texto: '', subidos: item.subidos?.video ? { video: item.subidos.video } : {} })
        item = await getQueued(item.clientId)
      } catch (error) {
        stopped = stopFor(error)
        if (stopped) break
        const fallo = error instanceof ApiError ? error.message : FAILED_MESSAGE
        await updateQueued(item.clientId, { fallo })
        failed.push({ ...summary, fallo })
        continue
      }
    }

    // Phase 2: the video of a story that is already on the server.
    try {
      await sendVideoFile(item.codigo, item.video, {
        userId: narratorId,
        uploaded: alreadyUploaded(item),
        onUploaded: rememberUploads(item, { ...item.subidos }),
        onProgress: (percent) => onVideoProgress?.(item.clientId, percent),
      })
      await removeQueued(item.clientId)
      videos.push(summary)
    } catch (error) {
      stopped = stopFor(error)
      if (stopped === STOPPED.offline || stopped === STOPPED.auth) break
      const attempts = (item.intentos ?? 0) + (stopped ? 1 : 0)
      if (stopped && attempts < MAX_VIDEO_ATTEMPTS) {
        await updateQueued(item.clientId, { intentos: attempts }) // trouble that may pass: later
        break
      }
      const fallo = stopped ? VIDEO_FAILED_MESSAGE : error instanceof ApiError ? error.message : VIDEO_FAILED_MESSAGE
      await updateQueued(item.clientId, { fallo, intentos: attempts })
      failed.push({ ...summary, fase: 'video', fallo })
      stopped = null
    }
  }
  return { sent, videos, failed, stopped }
}
