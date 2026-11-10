import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pwa } from '../test/pwaRegister.js'
import { setSimulatedOffline } from './connectivity.js'
import { CHECK_EVERY_MS, LOOK_EVERY_MS, SLOW_AFTER_MS, applyUpdate, getSnapshot, resetUpdatesForTests, subscribe, watchForUpdates } from './updates.js'

beforeEach(() => {
  pwa.options = null
  pwa.updated = 0
  resetUpdatesForTests({ reload: () => {} })
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

  it('does not break when asked to update before anything was registered', async () => {
    await expect(applyUpdate()).resolves.toBeUndefined()
  })

  describe('"Actualizar" reloads the page by itself, whatever the browser does', () => {
    let reload
    let workers
    const waiting = () => ({ waiting: {}, update: vi.fn().mockResolvedValue() })

    beforeEach(() => {
      vi.useFakeTimers()
      reload = vi.fn()
      resetUpdatesForTests({ reload })
      workers = new EventTarget()
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: workers })
      watchForUpdates({ enabled: true })
    })
    afterEach(() => {
      delete navigator.serviceWorker
    })

    it('reloads when the new version takes over, and only once', async () => {
      pwa.options.onRegisteredSW('/sw.js', waiting())
      pwa.options.onNeedRefresh()

      await applyUpdate()
      expect(pwa.updated).toBe(1)
      expect(reload).not.toHaveBeenCalled() // still switching

      workers.dispatchEvent(new Event('controllerchange'))
      expect(reload).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(60_000)
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('never reloads before the new version took over, and reloads as soon as the waiting version is gone', async () => {
      const worker = waiting()
      pwa.options.onRegisteredSW('/sw.js', worker)
      pwa.options.onNeedRefresh()

      await applyUpdate()
      vi.advanceTimersByTime(5 * 60_000) // reloading now would only bring the old version back
      expect(reload).not.toHaveBeenCalled()

      worker.waiting = null // it took over, and the browser never said so
      vi.advanceTimersByTime(LOOK_EVERY_MS)
      expect(reload).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(60_000)
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('says it is taking long when the version does not take over (the app is open in another tab)', async () => {
      pwa.options.onRegisteredSW('/sw.js', waiting())
      pwa.options.onNeedRefresh()
      const heard = vi.fn()
      subscribe(heard)

      await applyUpdate()
      vi.advanceTimersByTime(SLOW_AFTER_MS - 1)
      expect(getSnapshot().slow).toBe(false)

      vi.advanceTimersByTime(1)
      expect(getSnapshot()).toMatchObject({ available: true, applying: true, slow: true })
      expect(heard).toHaveBeenCalled()
    })

    it('does not say it is taking long when it already reloaded', async () => {
      pwa.options.onRegisteredSW('/sw.js', waiting())
      pwa.options.onNeedRefresh()

      await applyUpdate()
      workers.dispatchEvent(new Event('controllerchange'))
      vi.advanceTimersByTime(SLOW_AFTER_MS)

      expect(getSnapshot().slow).toBe(false)
    })

    it('reloads at once when nothing is waiting any more (another tab already switched)', async () => {
      pwa.options.onRegisteredSW('/sw.js', { waiting: null, update: vi.fn().mockResolvedValue() })
      pwa.options.onNeedRefresh()

      await applyUpdate()

      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('says it is updating, and a second click does not start it again', async () => {
      pwa.options.onRegisteredSW('/sw.js', waiting())
      pwa.options.onNeedRefresh()
      expect(getSnapshot().applying).toBe(false)

      await applyUpdate()
      await applyUpdate()

      expect(getSnapshot().applying).toBe(true)
      expect(pwa.updated).toBe(1)
    })
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
