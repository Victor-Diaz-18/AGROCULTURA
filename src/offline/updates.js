/**
 * New versions of the app (PWA). The service worker downloads a new version in the background and keeps it waiting;
 * here the page hears about it so it can say "Hay una versión nueva" and let the person choose when to update, since
 * updating reloads the page. Without a choice nothing changes until the app is closed and opened again.
 */

import { registerSW } from 'virtual:pwa-register'
import { isOnline } from './connectivity.js'

/** A phone keeps the app open for days: look for a new version this often, and every time the app comes back to the front. */
export const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * After "Actualizar" the browser may take a while to hand over to the new version, and while the app is open in another
 * tab or window it may not do it at all: reloading before that only brings the old version back. So the page looks
 * this often for the waiting version to be gone, and after a moment the notice says what is holding it (`slow`).
 */
export const LOOK_EVERY_MS = 500
export const SLOW_AFTER_MS = 6000

const listeners = new Set()
let snapshot = { available: false, applying: false, slow: false }
let updateServiceWorker = null
let registration = null
let timers = [] // of the update under way
let reloadPage = () => window.location.reload()

function publish(next) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

/** For useSyncExternalStore. */
export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot() {
  return snapshot
}

function keepLooking(registration) {
  const check = () => {
    if (isOnline()) registration.update().catch(() => {}) // without signal there is nothing to find
  }
  setInterval(check, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

/** Registers the service worker and starts listening. Only where there is one (the built app, not `npm run dev`). */
export function watchForUpdates({ enabled = import.meta.env.PROD && 'serviceWorker' in navigator } = {}) {
  if (!enabled) return
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      publish({ ...snapshot, available: true })
    },
    onRegisteredSW(_url, found) {
      registration = found ?? null
      if (found) keepLooking(found)
    },
  })
}

/**
 * "Actualizar": the waiting version takes over and the page reloads.
 *
 * The reload is done here and not left to the service worker library, which only reloads a page that was already
 * controlled by a worker when it opened (a page opened with Ctrl+Shift+R is not, and there the button did nothing one
 * could see). It happens when the new version takes over (the browser says so, or the waiting version is simply gone:
 * another tab may have switched already) and never before. Meanwhile the notice says "Actualizando…" (`applying`), and
 * if it takes long, that the other tabs of the app have to be closed (`slow`): the page reloads by itself after that.
 */
export async function applyUpdate() {
  if (snapshot.applying) return
  publish({ ...snapshot, applying: true })

  let done = false
  const reload = () => {
    if (done) return
    done = true
    stopTimers()
    reloadPage()
  }
  const workers = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
  workers?.addEventListener?.('controllerchange', reload, { once: true })

  try {
    await updateServiceWorker?.(true)
  } catch {
    // the checks below still reload with the newest version the browser has
  }
  if (registration === null) return // nothing to look at: the browser will say when the version changes
  const gone = () => !registration.waiting
  if (gone()) return reload()
  timers = [
    setInterval(() => gone() && reload(), LOOK_EVERY_MS),
    setTimeout(() => !done && publish({ ...snapshot, slow: true }), SLOW_AFTER_MS),
  ]
}

function stopTimers() {
  timers.forEach((timer) => clearTimeout(timer)) // clears intervals too
  timers = []
}

export function resetUpdatesForTests({ reload = () => window.location.reload() } = {}) {
  stopTimers()
  snapshot = { available: false, applying: false, slow: false }
  updateServiceWorker = null
  registration = null
  reloadPage = reload
  listeners.clear()
}
