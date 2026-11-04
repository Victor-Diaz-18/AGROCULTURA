/**
 * New versions of the app (PWA). The service worker downloads a new version in the background and keeps it waiting;
 * here the page hears about it so it can say "Hay una versión nueva" and let the person choose when to update, since
 * updating reloads the page. Without a choice nothing changes until the app is closed and opened again.
 */

import { registerSW } from 'virtual:pwa-register'
import { isOnline } from './connectivity.js'

/** A phone keeps the app open for days: look for a new version this often, and every time the app comes back to the front. */
export const CHECK_EVERY_MS = 60 * 60 * 1000

const listeners = new Set()
let snapshot = { available: false }
let updateServiceWorker = null

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
      snapshot = { available: true }
      listeners.forEach((listener) => listener())
    },
    onRegisteredSW(_url, registration) {
      if (registration) keepLooking(registration)
    },
  })
}

/** "Actualizar": the waiting version takes over and the page reloads. */
export function applyUpdate() {
  return updateServiceWorker?.(true)
}

export function resetUpdatesForTests() {
  snapshot = { available: false }
  updateServiceWorker = null
  listeners.clear()
}
