import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pwa } from '../test/pwaRegister.js'
import { setSimulatedOffline } from './connectivity.js'
import { CHECK_EVERY_MS, applyUpdate, getSnapshot, resetUpdatesForTests, subscribe, watchForUpdates } from './updates.js'

beforeEach(() => {
  pwa.options = null
  pwa.updated = 0
  resetUpdatesForTests()
})
afterEach(() => vi.useRealTimers())

describe('new versions of the app', () => {
  it('registers the service worker where there is one', () => {
    watchForUpdates({ enabled: true })

    expect(pwa.options).toMatchObject({ immediate: true })
  })

  it('does nothing where there is no service worker (development, tests)', () => {
    watchForUpdates()

    expect(pwa.options).toBeNull()
  })

  it('knows nothing is waiting until the browser says so, then tells everyone who listens', () => {
    watchForUpdates({ enabled: true })
    const heard = vi.fn()
    subscribe(heard)
    expect(getSnapshot().available).toBe(false)

    pwa.options.onNeedRefresh()

    expect(getSnapshot().available).toBe(true)
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('"Actualizar" hands over to the waiting version', async () => {
    watchForUpdates({ enabled: true })

    await applyUpdate()

    expect(pwa.updated).toBe(1)
  })

  it('does not break when asked to update before anything was registered', () => {
    expect(() => applyUpdate()).not.toThrow()
  })

  describe('looking for one', () => {
    const registration = () => ({ update: vi.fn().mockResolvedValue(undefined) })

    it('checks every hour, and not without signal', () => {
      vi.useFakeTimers()
      const worker = registration()
      watchForUpdates({ enabled: true })
      pwa.options.onRegisteredSW('/sw.js', worker)

      vi.advanceTimersByTime(CHECK_EVERY_MS)
      expect(worker.update).toHaveBeenCalledTimes(1)

      setSimulatedOffline(true)
      vi.advanceTimersByTime(CHECK_EVERY_MS)
      expect(worker.update).toHaveBeenCalledTimes(1)
    })

    it('checks when the app comes back to the front', () => {
      const worker = registration()
      watchForUpdates({ enabled: true })
      pwa.options.onRegisteredSW('/sw.js', worker)

      document.dispatchEvent(new Event('visibilitychange')) // jsdom: the page is "visible"

      expect(worker.update).toHaveBeenCalledTimes(1)
    })

    it('a failed check is not an error for the person', async () => {
      const worker = { update: vi.fn().mockRejectedValue(new Error('network')) }
      watchForUpdates({ enabled: true })
      pwa.options.onRegisteredSW('/sw.js', worker)

      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()

      expect(worker.update).toHaveBeenCalled() // and nothing was thrown
    })
  })
})
