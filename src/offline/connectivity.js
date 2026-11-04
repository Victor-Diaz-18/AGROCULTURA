/**
 * Effective connectivity = the browser's real connection AND the demo switch
 * "Simular conexión" (F10) being on. Everything that talks to the network asks
 * `isOnline()`, so switching the demo to "Sin señal" truly behaves as offline.
 */

const STORAGE_KEY = 'agrocultura.simulated-offline'

function readStoredFlag() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false // storage can be blocked (private mode)
  }
}

function writeStoredFlag(value) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, '1')
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* the switch still works for this page load */
  }
}

let realOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false
let simulatedOffline = readStoredFlag()
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
  writeStoredFlag(value)
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
  writeStoredFlag(simulated)
  snapshot = compute()
  listeners.clear()
  reconnectListeners.clear()
}
