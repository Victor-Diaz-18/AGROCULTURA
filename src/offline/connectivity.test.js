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
  it('is online when the browser is online and the demo switch is off', () => {
    expect(isOnline()).toBe(true)
  })

  it('goes offline when the demo switch simulates no signal', () => {
    setSimulatedOffline(true)

    expect(isOnline()).toBe(false)
    expect(getSnapshot()).toMatchObject({ realOnline: true, simulatedOffline: true, online: false })
  })

  it('is offline when the real connection drops, even if the demo switch is off', () => {
    window.dispatchEvent(new Event('offline'))

    expect(isOnline()).toBe(false)
    expect(getSnapshot().simulatedOffline).toBe(false)

    window.dispatchEvent(new Event('online'))
    expect(isOnline()).toBe(true)
  })

  it('stays offline while either source says offline', () => {
    setSimulatedOffline(true)
    window.dispatchEvent(new Event('online')) // real connection back, demo still "sin señal"

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

  it('keeps the simulated state for the browser tab (survives a reload)', () => {
    setSimulatedOffline(true)

    expect(sessionStorage.getItem('agrocultura.simulated-offline')).toBe('1')

    setSimulatedOffline(false)
    expect(sessionStorage.getItem('agrocultura.simulated-offline')).toBeNull()
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
