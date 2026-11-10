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
 * After "Actualizar" the browser usually hands over to the new version at once, but while the app is open in another
 * tab or window that tab can hold the old one for minutes. Nobody should have to find and close anything:
 *  - the tab that updates tells the others (`CHANNEL`), and they step aside by reloading themselves, which is what
 *    lets the new version in;
 *  - if after the wait it still has not taken over (a tab that is busy, or that runs a version from before this),
 *    this page leaves the old copy behind (see `leaveOldVersion`).
 * Meanwhile the page looks this often for the waiting version to be gone.
 */
export const LOOK_EVERY_MS = 500
export const TAKEOVER_WAIT_MS = 3000
const CHANNEL = 'agrocultura-actualizar'
const UPDATING = 'actualizar'

/** Pages where a reload nobody asked for would lose work in progress: a tab on one of these does not step aside. */
const BUSY_PATHS = ['/contar', '/historias-propias', '/admin/historias']

/**
 * What a page leaves for the one that opens next in the same tab, when it reloads in the middle of an update. Read
 * once, at start-up, and only believed for a short while: a version that arrives later is a different one and is
 * announced as usual.
 *  - NEW_PAGE: that page came from the network, so it already is the new version. It must not ask again: it only
 *    tells the worker that is still waiting to take over, quietly.
 *  - RELOAD_AGAIN: that page stepped aside for another tab and may still be the old version. It reloads once more as
 *    soon as the new version is in.
 */
const MARK_KEY = 'agrocultura.actualizando'
const NEW_PAGE = 'nueva'
const RELOAD_AGAIN = 'otra-vez'
export const FINISHING_FOR_MS = 30 * 1000

function leaveMark(value) {
  try {
    if (value) sessionStorage.setItem(MARK_KEY, value)
    else sessionStorage.removeItem(MARK_KEY)
  } catch {
    /* without storage the next page simply shows the notice again */
  }
}

function takeMark() {
  try {
    const value = sessionStorage.getItem(MARK_KEY)
    sessionStorage.removeItem(MARK_KEY)
    return value
  } catch {
    return null
  }
}

const listeners = new Set()
let snapshot = { available: false, applying: false, failed: false }
let updateServiceWorker = null
let registration = null
let channel = null
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

const workers = () => (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined)

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
  let mark = takeMark()
  if (mark) setTimeout(() => (mark = null), FINISHING_FOR_MS)

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (mark === NEW_PAGE) {
        // This page is already the new version: the waiting worker is the same one, so it takes over with no reload.
        mark = null
        Promise.resolve(updateServiceWorker?.(true)).catch(() => {})
        return
      }
      if (mark === RELOAD_AGAIN) return // the reload below is coming: no notice for a moment
      publish({ ...snapshot, available: true })
    },
    onRegisteredSW(_url, found) {
      registration = found ?? null
      if (!found) return
      keepLooking(found)
      if (mark === RELOAD_AGAIN) reloadOnceTheNewVersionIsIn(() => mark === RELOAD_AGAIN, () => (mark = null))
    },
  })

  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.addEventListener('message', (event) => event.data === UPDATING && stepAside())
  } catch {
    channel = null // an old browser: the other tabs are simply left behind (see leaveOldVersion)
  }
}

/** Another tab of the app is updating and this one holds the old version just by being open: reload to let it go. */
function stepAside() {
  if (snapshot.applying) return // this tab is updating too
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  if (BUSY_PATHS.some((busy) => path.startsWith(busy))) return // somebody may be in the middle of a story here
  leaveMark(RELOAD_AGAIN)
  reloadPage()
}

/** After stepping aside: this page may still be the old version, so it reloads once the new one has taken over. */
function reloadOnceTheNewVersionIsIn(stillWanted, done) {
  const reload = () => {
    if (!stillWanted()) return
    done()
    clearInterval(looking)
    reloadPage()
  }
  workers()?.addEventListener?.('controllerchange', reload, { once: true })
  const looking = setInterval(() => {
    if (!stillWanted()) return clearInterval(looking) // too long: this page stays, and says so if a version is waiting
    if (!registration.waiting) reload()
  }, LOOK_EVERY_MS)
  timers.push(looking)
  if (!registration.waiting) reload()
}

/**
 * "Actualizar": the waiting version takes over and the page reloads.
 *
 * The reload is done here and not left to the service worker library, which only reloads a page that was already
 * controlled by a worker when it opened (a page opened with Ctrl+Shift+R is not, and there the button did nothing one
 * could see). It happens when the new version takes over (the browser says so, or the waiting version is simply gone:
 * another tab may have switched already). Meanwhile the notice says "Actualizando…" (`applying`).
 */
export async function applyUpdate() {
  if (snapshot.applying) return
  publish({ ...snapshot, applying: true, failed: false })

  let done = false
  const reload = () => {
    if (done) return
    done = true
    stopTimers()
    reloadPage()
  }
  workers()?.addEventListener?.('controllerchange', reload, { once: true })

  try {
    channel?.postMessage(UPDATING) // the other tabs step aside
    await updateServiceWorker?.(true)
  } catch {
    // the checks below still reload with the newest version the browser has
  }
  if (registration === null) return // nothing to look at: the browser will say when the version changes
  const gone = () => !registration.waiting
  if (gone()) return reload()
  timers = [
    setInterval(() => gone() && reload(), LOOK_EVERY_MS),
    setTimeout(async () => {
      if (done) return
      if (await leaveOldVersion()) return reload()
      stopTimers()
      workers()?.removeEventListener?.('controllerchange', reload)
      publish({ ...snapshot, applying: false, failed: true }) // no signal: the button can be pressed again
    }, TAKEOVER_WAIT_MS),
  ]
}

/**
 * The old version is still being held (by a tab that could not step aside) and the new one cannot take over. This page
 * lets go of the old copy: with the registration removed, the reload comes from the network (the new version), which
 * registers itself again and tells the waiting worker to take over (NEW_PAGE). The tab that was holding it keeps
 * working and gets the new version on its next load. Only with the server in reach: without the registration the app
 * cannot open with no signal, so it is not removed unless the new version can really be fetched. Answers whether it
 * did it.
 */
async function leaveOldVersion() {
  try {
    // Not a file the service worker keeps, so this answer can only come from the network.
    const answer = await fetch(`/sw.js?comprobar=${Date.now()}`, { cache: 'no-store' })
    if (!answer.ok) return false
    leaveMark(NEW_PAGE)
    if ((await registration.unregister()) !== false) return true
  } catch {
    // falls through: nothing was left behind
  }
  leaveMark(null)
  return false
}

function stopTimers() {
  timers.forEach((timer) => clearTimeout(timer)) // clears intervals too
  timers = []
}

export function resetUpdatesForTests({ reload = () => window.location.reload() } = {}) {
  stopTimers()
  leaveMark(null)
  channel?.close?.()
  channel = null
  snapshot = { available: false, applying: false, failed: false }
  updateServiceWorker = null
  registration = null
  reloadPage = reload
  listeners.clear()
}
