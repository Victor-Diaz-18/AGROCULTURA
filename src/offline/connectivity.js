/**
 * Effective connectivity = the browser's real connection AND nobody having cut it by hand. Everything that talks to the
 * network asks `isOnline()`, so a cut connection truly behaves as offline.
 *
 * The page has no way to cut it any more: that was the demo switch «Simular conexión», removed on 24 Nov 2026 because a
 * family would take it for a real setting. The tests still cut it with `setSimulatedOffline`. Nothing is kept between page
 * loads, and the flag that switch left in sessionStorage is not read, so a tab where it was on comes back online.
 */

let realOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false
let simulatedOffline = false
const listeners = new Set()

function compute() {
  return { realOnline, simulatedOffline, online: realOnline && !simulatedOffline }
}

let snapshot = compute()

function emit() {
  const wasOnline = snapshot.online
  snapshot = compute()
  listeners.forEach((listener) => listener())
  if (!wasOnline && snapshot.online) reconnectListeners.forEach((callback) => callback())
}

const reconnectListeners = new Set()

/** For useSyncExternalStore. */
export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Stable object between changes, as useSyncExternalStore requires. */
export function getSnapshot() {
  return snapshot
}

export function isOnline() {
  return snapshot.online
}

export function setSimulatedOffline(value) {
  if (value === simulatedOffline) return
  simulatedOffline = value
  emit()
}

export function toggleSimulatedOffline() {
  setSimulatedOffline(!simulatedOffline)
}

/** Calls `callback` every time the effective connection goes from offline to online. */
export function onReconnect(callback) {
  reconnectListeners.add(callback)
  return () => reconnectListeners.delete(callback)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    realOnline = true
    emit()
  })
  window.addEventListener('offline', () => {
    realOnline = false
    emit()
  })
}

/** Test helper: back to a known state without notifying anyone. */
export function resetConnectivityForTests({ real = true, simulated = false } = {}) {
  realOnline = real
  simulatedOffline = simulated
  snapshot = compute()
  listeners.clear()
  reconnectListeners.clear()
}
