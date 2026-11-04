import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import useConnectivity from '../hooks/useConnectivity.js'
import { isOnline } from '../offline/connectivity.js'
import { STOPPED, flushQueue } from '../offline/outbox.js'
import { deviceStorage, listQueued, queueStory, removeQueued, updateQueued } from '../offline/store.js'
import { useAuth } from './AuthContext.jsx'
import { usePortalData } from './PortalDataContext.jsx'
import { useToast } from './ToastContext.jsx'

/**
 * The stories kept on the phone because there was no signal (F10), and the work of sending them.
 *
 * A narrator's finished story is saved here ("Guardar en el dispositivo") and goes out by itself: when the signal
 * returns, when the app opens with signal, and again after a minute if the server or the connection failed.
 * Each person only ever sees and sends their own.
 */

/** Wait before trying again after a failure that is not the story's fault. */
export const RETRY_MS = 60_000

let retryDelay = RETRY_MS
/** Tests do not wait a minute. */
export const setRetryDelayForTests = (ms = RETRY_MS) => {
  retryDelay = ms
}

export const OUTBOX_MESSAGES = {
  sentOne: 'se envió 1 borrador a revisión.',
  sentMany: (count) => `se enviaron ${count} borradores a revisión.`,
  failed: 'Una historia no se pudo enviar. Revisa «Mis historias».',
  expired: 'Tu sesión venció. Ingresa de nuevo y se enviarán tus borradores.',
}

const OutboxContext = createContext({
  items: [],
  waiting: 0,
  persistent: true,
  sentVersion: 0,
  enqueue: () => Promise.resolve(),
  retry: () => Promise.resolve(),
  discard: () => Promise.resolve(),
})

const sentMessage = (count, afterReconnect) => {
  const text = count === 1 ? OUTBOX_MESSAGES.sentOne : OUTBOX_MESSAGES.sentMany(count)
  return afterReconnect ? `Volvió la señal: ${text}` : `${text[0].toUpperCase()}${text.slice(1)}`
}

export function OutboxProvider({ children }) {
  const toast = useToast()
  const { user } = useAuth()
  const { reload: reloadPortal } = usePortalData()
  const { online } = useConnectivity()
  const narratorId = user?.rol === 'narrador' ? user.id : null

  const [items, setItems] = useState([]) // newest first, without their files
  const [persistent, setPersistent] = useState(true)
  const [sentVersion, setSentVersion] = useState(0)
  const active = useRef(narratorId)
  const flushing = useRef(false)
  const retryTimer = useRef(null)
  const wasOnline = useRef(online)

  const refresh = useCallback(async () => {
    if (!narratorId) return
    const waiting = await listQueued(narratorId).catch(() => [])
    if (active.current === narratorId) setItems([...waiting].reverse())
  }, [narratorId])

  const flush = useCallback(
    async (afterReconnect = false) => {
      if (!narratorId || flushing.current || !isOnline()) return
      flushing.current = true
      let result
      try {
        result = await flushQueue(narratorId)
      } catch {
        return // the phone's storage failed: the stories stay where they are
      } finally {
        flushing.current = false
      }
      if (active.current !== narratorId) return

      const { sent, failed, stopped } = result
      await refresh()
      if (sent.length > 0) {
        toast(sentMessage(sent.length, afterReconnect))
        setSentVersion((version) => version + 1)
        reloadPortal() // the public counters change when a story enters review
      }
      if (failed.length > 0) toast(OUTBOX_MESSAGES.failed, 'info')
      if (stopped === STOPPED.auth) toast(OUTBOX_MESSAGES.expired, 'info')
      // Not the story's fault (server trouble, or a connection that dropped while the browser still says it is on): later.
      if (stopped === STOPPED.server || (stopped === STOPPED.offline && isOnline())) {
        clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => flush(false), retryDelay)
      }
    },
    [narratorId, refresh, reloadPortal, toast],
  )

  // Whoever is signed in sees their own waiting stories only.
  useEffect(() => {
    active.current = narratorId
    clearTimeout(retryTimer.current)
    setItems([])
    refresh()
    return () => clearTimeout(retryTimer.current)
  }, [narratorId, refresh])

  useEffect(() => {
    deviceStorage().then(setPersistent)
  }, [])

  // With signal (when the app opens, when it comes back, when someone signs in): send what is waiting.
  useEffect(() => {
    const returned = online && !wasOnline.current
    wasOnline.current = online
    if (narratorId && online) flush(returned)
  }, [narratorId, online, flush])

  /** Keeps a finished story on the phone. Rejects if the phone could not save it. */
  const enqueue = useCallback(
    async (draft) => {
      if (!narratorId) throw new Error('No hay sesión.')
      const item = { ...draft, narratorId, guardadoEn: new Date().toISOString(), subidos: draft.subidos ?? {}, fallo: null }
      await queueStory(item)
      await refresh()
      if (isOnline()) {
        // It was queued because a send just failed although the browser says there is signal: try again soon.
        clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => flush(false), retryDelay)
      }
    },
    [narratorId, refresh, flush],
  )

  /** The person asks again for a story the server had refused. */
  const retry = useCallback(
    async (clientId) => {
      await updateQueued(clientId, { fallo: null })
      await refresh()
      flush(false)
    },
    [refresh, flush],
  )

  const discard = useCallback(
    async (clientId) => {
      await removeQueued(clientId)
      await refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      items,
      waiting: items.filter((item) => !item.fallo).length,
      persistent,
      sentVersion,
      enqueue,
      retry,
      discard,
    }),
    [items, persistent, sentVersion, enqueue, retry, discard],
  )
  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>
}

export function useOutbox() {
  return useContext(OutboxContext)
}
