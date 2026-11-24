/**
 * New versions of the app (PWA). Every deploy is a new version: the service worker downloads it in the background and
 * keeps it waiting, and switching to it reloads the page. Nobody is asked: the page switches by itself at the next
 * moment when a reload loses nothing (see `switchIfSafe`):
 *  - right after the page opens or comes back to the front (`FRESH_FOR_MS`): a page opened after a deploy still starts
 *    with the old version the browser kept, and finds the new one while it loads;
 *  - when the person moves to another screen of the app (`screenChanged`, called by UpdateOnScreenChange).
 * Never on a page where somebody may be in the middle of a story (`BUSY_PATHS`): there it waits until they leave it.
 */

import { registerSW } from 'virtual:pwa-register'
import { isOnline } from './connectivity.js'

/** A phone keeps the app open for days: look for a new version this often, and every time the app comes back to the front. */
export const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * When the page switches, the browser usually hands over to the new version at once, but while the app is open in
 * another tab or window that tab can hold the old one for minutes. Nobody should have to find and close anything:
 *  - the tab that switches tells the others (`CHANNEL`), and they step aside by reloading themselves, which is what
 *    lets the new version in;
 *  - if after the wait it still has not taken over (a tab that is busy, or that runs a version from before this),
 *    this page leaves the old copy behind (see `leaveOldVersion`).
 * Meanwhile the page looks this often for the waiting version to be gone.
 */
export const LOOK_EVERY_MS = 500
export const TAKEOVER_WAIT_MS = 3000

/** For this long after the page opens or comes back to the front, nothing has been done on it yet: it can switch. */
export const FRESH_FOR_MS = 10 * 1000
const CHANNEL = 'agrocultura-actualizar'
const UPDATING = 'actualizar'

/**
 * Pages where a reload nobody asked for would lose work in progress (a recording, a story being typed, a review being
 * decided): a tab on one of these does not switch, step aside nor reload when the new version takes over. It switches
 * when the person leaves the page, or the next time the app opens.
 */
const BUSY_PATHS = ['/contar', '/admin/historias', '/admin/revision']

function onBusyPage() {
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  return BUSY_PATHS.some((busy) => path.startsWith(busy))
}

/**
 * What a page leaves for the one that opens next in the same tab, when it reloads in the middle of an update. Read
 * once, at start-up, and only believed for a short while: a version that arrives later is a different one and is
 * handled as usual.
 *  - NEW_PAGE: that page came from the network, so it already is the new version. It only tells the worker that is
 *    still waiting to take over, quietly, with no reload.
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
    /* without storage the next page simply switches as usual */
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

let pending = false // a new version is waiting for the next safe moment
let applying = false // the switch is under way
let updateServiceWorker = null
let registration = null
let channel = null
let timers = [] // of the switch under way
let reloadPage = () => window.location.reload()
let freshFor = FRESH_FOR_MS
let shownAt = 0 // when the page opened or last came back to the front

const workers = () => (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined)
const justShown = () => Date.now() - shownAt < freshFor

/** Switches to the waiting version, unless there is none, it is already switching, or somebody may be busy here. */
function switchIfSafe() {
  if (!pending || applying || onBusyPage()) return
  applyUpdate()
}

/** The person moved to another screen of the app: a reload now loses nothing, so a waiting version comes in. */
export function screenChanged() {
  switchIfSafe()
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
  shownAt = Date.now()
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
      pending = true
      if (mark === RELOAD_AGAIN) return // the reload below is coming; if it never does, the next safe moment switches
      // Just opened or just back: switch now. On the next turn, once the registration is known (the browser may say
      // this first), so the checks of applyUpdate can still leave the old copy behind.
      if (justShown()) setTimeout(switchIfSafe, 0)
    },
    // The new version took over. Without this the plugin reloads every tab that saw it arrive, busy or not.
    onNeedReload() {
      if (applying) return // this tab is switching: applyUpdate reloads it
      if (onBusyPage()) return // somebody may be in the middle of a story here
      reloadPage()
    },
    onRegisteredSW(_url, found) {
      registration = found ?? null
      if (!found) return
      keepLooking(found)
      if (mark === RELOAD_AGAIN) reloadOnceTheNewVersionIsIn(() => mark === RELOAD_AGAIN, () => (mark = null))
    },
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    shownAt = Date.now() // back to the front: a version waiting since before, or found now, comes in
    switchIfSafe()
  })

  try {
    channel = new BroadcastChannel(CHANNEL)
    channel.addEventListener('message', (event) => event.data === UPDATING && stepAside())
  } catch {
    channel = null // an old browser: the other tabs are simply left behind (see leaveOldVersion)
  }
}

/** Another tab of the app is switching and this one holds the old version just by being open: reload to let it go. */
function stepAside() {
  if (applying) return // this tab is switching too
  if (onBusyPage()) return // somebody may be in the middle of a story here
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
    if (!stillWanted()) return clearInterval(looking) // too long: this page stays, and switches at the next safe moment
    if (!registration.waiting) reload()
  }, LOOK_EVERY_MS)
  timers.push(looking)
  if (!registration.waiting) reload()
}

/**
 * The switch: the waiting version takes over and the page reloads.
 *
 * The reload is done here and not left to the service worker library, which only reloads a page that was already
 * controlled by a worker when it opened (a page opened with Ctrl+Shift+R is not). It happens when the new version takes
 * over (the browser says so, or the waiting version is simply gone: another tab may have switched already). Without
 * signal, when that cannot happen, the page stays as it is and tries again at the next safe moment.
 */
export async function applyUpdate() {
  if (applying) return
  applying = true

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
      applying = false // no signal: still waiting, for the next safe moment
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

/** `freshForMs` is 0 unless a test is about a page that has just been opened or come back to the front. */
export function resetUpdatesForTests({ reload = () => window.location.reload(), freshForMs = 0 } = {}) {
  stopTimers()
  leaveMark(null)
  channel?.close?.()
  channel = null
  pending = false
  applying = false
  updateServiceWorker = null
  registration = null
  reloadPage = reload
  freshFor = freshForMs
  shownAt = 0
}
