import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSnapshot,
  isOnline,
  onReconnect,
  resetConnectivityForTests,
  setSimulatedOffline,
  subscribe,
  toggleSimulatedOffline,
} from './connectivity.js'

beforeEach(() => resetConnectivityForTests())

describe('connectivity', () => {
  it('is online when the browser is online and nobody cut the connection', () => {
    expect(isOnline()).toBe(true)
  })

  it('goes offline when the connection is cut by hand (as the tests do)', () => {
    setSimulatedOffline(true)

    expect(isOnline()).toBe(false)
    expect(getSnapshot()).toMatchObject({ realOnline: true, simulatedOffline: true, online: false })
  })

  it('is offline when the real connection drops, even if nobody cut it', () => {
    window.dispatchEvent(new Event('offline'))

    expect(isOnline()).toBe(false)
    expect(getSnapshot().simulatedOffline).toBe(false)

    window.dispatchEvent(new Event('online'))
    expect(isOnline()).toBe(true)
  })

  it('stays offline while either source says offline', () => {
    setSimulatedOffline(true)
    window.dispatchEvent(new Event('online')) // real connection back, still cut by hand

    expect(isOnline()).toBe(false)
  })

  it('notifies subscribers only when something changes', () => {
    const listener = vi.fn()
    subscribe(listener)

    setSimulatedOffline(false) // no change
    expect(listener).not.toHaveBeenCalled()

    toggleSimulatedOffline()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps nothing for the next page load', () => {
    setSimulatedOffline(true)

    expect(sessionStorage.getItem('agrocultura.simulated-offline')).toBeNull()
  })

  it('a tab where the old switch «Simular conexión» was left on comes back online with this version', async () => {
    sessionStorage.setItem('agrocultura.simulated-offline', '1') // what that switch kept for the tab
    vi.resetModules()

    const fresh = await import('./connectivity.js')

    expect(fresh.isOnline()).toBe(true)
  })

  it('calls reconnect listeners when the signal comes back, not when it leaves', () => {
    const onBack = vi.fn()
    onReconnect(onBack)

    setSimulatedOffline(true)
    expect(onBack).not.toHaveBeenCalled()

    setSimulatedOffline(false)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
