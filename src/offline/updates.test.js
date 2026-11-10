import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pwa } from '../test/pwaRegister.js'
import { setSimulatedOffline } from './connectivity.js'
import { CHECK_EVERY_MS, FINISHING_FOR_MS, LOOK_EVERY_MS, TAKEOVER_WAIT_MS, applyUpdate, getSnapshot, resetUpdatesForTests, subscribe, watchForUpdates } from './updates.js'

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
    const waiting = () => ({ waiting: {}, update: vi.fn().mockResolvedValue(), unregister: vi.fn().mockResolvedValue(true) })

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
      sessionStorage.clear()
    })
    /** A new page of the same tab: everything starts again, but the tab keeps what it stored. */
    const resetUpdatesForTestsKeepingMark = () => {
      const mark = sessionStorage.getItem('agrocultura.actualizando')
      resetUpdatesForTests({ reload })
      if (mark) sessionStorage.setItem('agrocultura.actualizando', mark)
    }

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

    it('reloads as soon as the waiting version is gone, even if the browser never says so', async () => {
      const worker = waiting()
      pwa.options.onRegisteredSW('/sw.js', worker)
      pwa.options.onNeedRefresh()

      await applyUpdate()
      vi.advanceTimersByTime(LOOK_EVERY_MS)
      expect(reload).not.toHaveBeenCalled() // reloading now would only bring the old version back

      worker.waiting = null
      vi.advanceTimersByTime(LOOK_EVERY_MS)
      expect(reload).toHaveBeenCalledTimes(1)
      expect(worker.unregister).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(60_000)
      expect(reload).toHaveBeenCalledTimes(1)
      expect(worker.unregister).not.toHaveBeenCalled()
    })

    describe('when another tab holds the old version and the new one cannot take over', () => {
      it('leaves the old copy behind and reloads from the network: nobody has to close anything', async () => {
        const worker = waiting()
        const fetchMock = vi.fn(async () => new Response('', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        pwa.options.onRegisteredSW('/sw.js', worker)
        pwa.options.onNeedRefresh()

        await applyUpdate()
        await vi.advanceTimersByTimeAsync(TAKEOVER_WAIT_MS - 1)
        expect(worker.unregister).not.toHaveBeenCalled()
        expect(reload).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(1)
        expect(fetchMock.mock.calls[0][0]).toMatch(/^\/sw\.js\?comprobar=\d+$/) // the server answers before anything is removed
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
        expect(worker.unregister).toHaveBeenCalledTimes(1)
        expect(reload).toHaveBeenCalledTimes(1)
        expect(sessionStorage.getItem('agrocultura.actualizando')).toBe('nueva') // the page that opens next finishes the job

        await vi.advanceTimersByTimeAsync(60_000)
        expect(reload).toHaveBeenCalledTimes(1)
      })

      it('the page that opens after that does not ask again: it lets the waiting version take over quietly', async () => {
        sessionStorage.setItem('agrocultura.actualizando', 'nueva')
        resetUpdatesForTestsKeepingMark()
        watchForUpdates({ enabled: true })
        expect(sessionStorage.getItem('agrocultura.actualizando')).toBeNull() // read once

        pwa.options.onNeedRefresh()
        await vi.advanceTimersByTimeAsync(0)

        expect(getSnapshot().available).toBe(false) // no notice: this page is already the new version
        expect(pwa.updated).toBe(1) // the waiting version was told to take over
        expect(reload).not.toHaveBeenCalled()

        pwa.options.onNeedRefresh() // a version that arrives later is another one: announced as usual
        expect(getSnapshot().available).toBe(true)
        expect(pwa.updated).toBe(1)
      })

      it('the mark is only believed for a short while', async () => {
        sessionStorage.setItem('agrocultura.actualizando', 'nueva')
        resetUpdatesForTestsKeepingMark()
        watchForUpdates({ enabled: true })

        await vi.advanceTimersByTimeAsync(FINISHING_FOR_MS)
        pwa.options.onNeedRefresh()

        expect(getSnapshot().available).toBe(true)
        expect(pwa.updated).toBe(0)
      })

      it.each([
        ['there is no signal', async () => Promise.reject(new TypeError('Failed to fetch'))],
        ['the server does not answer well', async () => new Response('', { status: 503 })],
      ])('keeps the old copy when %s (without it the app would not open offline), and says it failed', async (_why, answer) => {
        const worker = waiting()
        vi.stubGlobal('fetch', vi.fn(answer))
        pwa.options.onRegisteredSW('/sw.js', worker)
        pwa.options.onNeedRefresh()

        await applyUpdate()
        await vi.advanceTimersByTimeAsync(TAKEOVER_WAIT_MS)

        expect(worker.unregister).not.toHaveBeenCalled()
        expect(reload).not.toHaveBeenCalled()
        expect(getSnapshot()).toMatchObject({ available: true, applying: false, failed: true })
        expect(sessionStorage.getItem('agrocultura.actualizando')).toBeNull()

        // The button works again: a second try with signal goes through.
        vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })))
        await applyUpdate()
        expect(getSnapshot()).toMatchObject({ applying: true, failed: false })
        await vi.advanceTimersByTimeAsync(TAKEOVER_WAIT_MS)
        expect(worker.unregister).toHaveBeenCalledTimes(1)
        expect(reload).toHaveBeenCalledTimes(1)
      })
    })

    describe('with the app open in other tabs', () => {
      /** Stands in for the browser: what one tab posts, the test can read; what another tab would post, the test delivers. */
      let posted
      let deliver
      beforeEach(() => {
        posted = []
        vi.stubGlobal(
          'BroadcastChannel',
          class {
            constructor(name) {
              this.name = name
            }
            addEventListener(_type, listener) {
              deliver = (data) => listener({ data })
            }
            postMessage(data) {
              posted.push([this.name, data])
            }
            close() {}
          },
        )
        resetUpdatesForTests({ reload })
        watchForUpdates({ enabled: true })
      })
      afterEach(() => window.history.replaceState(null, '', '/'))

      it('the tab that updates tells the others', async () => {
        pwa.options.onRegisteredSW('/sw.js', waiting())
        pwa.options.onNeedRefresh()

        await applyUpdate()

        expect(posted).toEqual([['agrocultura-actualizar', 'actualizar']])
      })

      it('a tab that hears it steps aside by reloading, so the new version can take over', () => {
        pwa.options.onRegisteredSW('/sw.js', waiting())

        deliver('actualizar')

        expect(reload).toHaveBeenCalledTimes(1)
        expect(sessionStorage.getItem('agrocultura.actualizando')).toBe('otra-vez')
      })

      it.each(['/contar', '/historias-propias', '/admin/historias'])('a tab on %s does not: somebody may be in the middle of a story', (path) => {
        window.history.replaceState(null, '', path)
        pwa.options.onRegisteredSW('/sw.js', waiting())

        deliver('actualizar')

        expect(reload).not.toHaveBeenCalled()
        expect(sessionStorage.getItem('agrocultura.actualizando')).toBeNull()
      })

      it('ignores anything else said on the channel', () => {
        deliver('otra cosa')

        expect(reload).not.toHaveBeenCalled()
      })

      it('after stepping aside, the page shows no notice and reloads once more when the new version is in', async () => {
        sessionStorage.setItem('agrocultura.actualizando', 'otra-vez')
        resetUpdatesForTestsKeepingMark()
        watchForUpdates({ enabled: true })
        const worker = waiting()
        pwa.options.onRegisteredSW('/sw.js', worker)
        pwa.options.onNeedRefresh()

        expect(getSnapshot().available).toBe(false)
        vi.advanceTimersByTime(LOOK_EVERY_MS)
        expect(reload).not.toHaveBeenCalled() // the new version is not in yet

        worker.waiting = null
        vi.advanceTimersByTime(LOOK_EVERY_MS)
        expect(reload).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(60_000)
        expect(reload).toHaveBeenCalledTimes(1)
      })

      it('after stepping aside, reloads at once if the new version already took over', () => {
        sessionStorage.setItem('agrocultura.actualizando', 'otra-vez')
        resetUpdatesForTestsKeepingMark()
        watchForUpdates({ enabled: true })

        pwa.options.onRegisteredSW('/sw.js', { waiting: null, update: vi.fn().mockResolvedValue() })

        expect(reload).toHaveBeenCalledTimes(1)
      })

      it('after stepping aside, if the new version never comes in, the page stays and announces it as usual', () => {
        sessionStorage.setItem('agrocultura.actualizando', 'otra-vez')
        resetUpdatesForTestsKeepingMark()
        watchForUpdates({ enabled: true })
        pwa.options.onRegisteredSW('/sw.js', waiting())

        vi.advanceTimersByTime(FINISHING_FOR_MS + LOOK_EVERY_MS)
        pwa.options.onNeedRefresh()

        expect(reload).not.toHaveBeenCalled()
        expect(getSnapshot().available).toBe(true)
      })
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
