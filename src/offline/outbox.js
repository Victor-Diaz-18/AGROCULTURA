/**
 * Sends the stories that were kept on the phone because there was no signal (F10).
 *
 * Safe to run any number of times: each story keeps the same `clientId`, so the server answers with the story it
 * already has instead of making a copy, and the files that already went up are not uploaded again.
 */

import { ApiError, OfflineError } from '../services/http.js'
import { sendStory } from '../services/stories.js'
import { getQueued, listQueued, removeQueued, updateQueued } from './store.js'

/** Why a round stopped before the end. In every case the stories that were not sent stay on the phone. */
export const STOPPED = {
  offline: 'offline', // the signal went away again
  auth: 'auth', // the session expired: the person has to sign in again
  server: 'server', // the server is having trouble: worth trying again in a while
}

const FAILED_MESSAGE = 'No pudimos enviar esta historia.'

/** A problem that may go away by itself: the server's, not the story's. */
const isServerTrouble = (error) => error instanceof ApiError && (error.status >= 500 || error.status === 408 || error.status === 429)

/** The files of this story that already went up in an earlier attempt, so they are not sent twice. */
function alreadyUploaded(item) {
  const uploaded = new WeakMap()
  if (item.audio && item.subidos?.audio) uploaded.set(item.audio.blob, item.subidos.audio)
  for (const photo of item.fotos) if (item.subidos?.[photo.id]) uploaded.set(photo.blob, item.subidos[photo.id])
  return uploaded
}

/**
 * One round over the waiting stories of a narrator, oldest first.
 * Answers { sent, failed, stopped }: `sent` and `failed` list the stories (`failed` are the ones the server
 * refused for good: they keep their reason and wait for the person), `stopped` is one of STOPPED or null.
 */
export async function flushQueue(narratorId, { send = sendStory } = {}) {
  const sent = []
  const failed = []
  let stopped = null

  for (const summary of await listQueued(narratorId)) {
    if (summary.fallo) continue // refused earlier: waits until the person asks to try again
    const item = await getQueued(summary.clientId)
    if (!item) continue // another tab sent it meanwhile

    const subidos = { ...item.subidos }
    try {
      await send(item, {
        uploaded: alreadyUploaded(item),
        onUploaded: async ({ key }, medio) => {
          subidos[key] = medio
          await updateQueued(item.clientId, { subidos }).catch(() => {}) // remembering is a courtesy: never fails the send
        },
      })
      await removeQueued(item.clientId)
      sent.push(summary)
    } catch (error) {
      if (error instanceof OfflineError) stopped = STOPPED.offline
      else if (error instanceof ApiError && error.status === 401) stopped = STOPPED.auth
      else if (isServerTrouble(error)) stopped = STOPPED.server
      if (stopped) break

      const fallo = error instanceof ApiError ? error.message : FAILED_MESSAGE
      await updateQueued(item.clientId, { fallo })
      failed.push({ ...summary, fallo })
    }
  }
  return { sent, failed, stopped }
}
