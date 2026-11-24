import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pwa } from '../test/pwaRegister.js'
import { setSimulatedOffline } from './connectivity.js'
import { CHECK_EVERY_MS, FINISHING_FOR_MS, FRESH_FOR_MS, LOOK_EVERY_MS, TAKEOVER_WAIT_MS, applyUpdate, resetUpdatesForTests, screenChanged, watchForUpdates } from './updates.js'

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

  it('nobody is asked: a version found while the page is in use comes in when the person moves to another screen', () => {
    watchForUpdates({ enabled: true })
    screenChanged()
    expect(pwa.updated).toBe(0) // nothing is waiting yet

    pwa.options.onNeedRefresh()
    expect(pwa.updated).toBe(0) // not in the middle of what the person is looking at

    screenChanged()
    expect(pwa.updated).toBe(1)
  })

  it('switching hands over to the waiting version', async () => {
    watchForUpdates({ enabled: true })

    await applyUpdate()

    expect(pwa.updated).toBe(1)
  })

  it('does not break when asked to update before anything was registered', async () => {
    await expect(applyUpdate()).resolves.toBeUndefined()
  })

  describe('switching reloads the page by itself, whatever the browser does', () => {
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

      it('the page that opens after that does not reload again: it lets the waiting version take over quietly', async () => {
        sessionStorage.setItem('agrocultura.actualizando', 'nueva')
        resetUpdatesForTestsKeepingMark()
        watchForUpdates({ enabled: true })
        expect(sessionStorage.getItem('agrocultura.actualizando')).toBeNull() // read once

        pwa.options.onNeedRefresh()
        await vi.advanceTimersByTimeAsync(0)

        expect(pwa.updated).toBe(1) // the waiting version was told to take over
        expect(reload).not.toHaveBeenCalled() // this page is already the new version

        pwa.options.onNeedRefresh() // a version that arrives later is another one: handled as usual
        expect(pwa.updated).toBe(1)
        screenChanged()
        expect(pwa.updated).toBe(2)
      })

      it('the mark is only believed for a short while', async () => {
        sessionStorage.setItem('agrocultura.actualizando', 'nueva')
        resetUpdatesForTestsKeepingMark()
        watchForUpdates({ enabled: true })

        await vi.advanceTimersByTimeAsync(FINISHING_FOR_MS)
        pwa.options.onNeedRefresh()

        expect(pwa.updated).toBe(0) // not taken as this page's own version: it waits for the next safe moment
      })

      it.each([
        ['there is no signal', async () => Promise.reject(new TypeError('Failed to fetch'))],
        ['the server does not answer well', async () => new Response('', { status: 503 })],
      ])('keeps the old copy when %s (without it the app would not open offline), and tries again later', async (_why, answer) => {
        const worker = waiting()
        vi.stubGlobal('fetch', vi.fn(answer))
        pwa.options.onRegisteredSW('/sw.js', worker)
        pwa.options.onNeedRefresh()

        await applyUpdate()
        await vi.advanceTimersByTimeAsync(TAKEOVER_WAIT_MS)

        expect(worker.unregister).not.toHaveBeenCalled()
        expect(reload).not.toHaveBeenCalled() // the page stays as it is, nothing to say to the person
        expect(sessionStorage.getItem('agrocultura.actualizando')).toBeNull()

        // At the next safe moment, with signal, it goes through.
        vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })))
        screenChanged()
        await vi.advanceTimersByTimeAsync(TAKEOVER_WAIT_MS)
        expect(worker.unregister).toHaveBeenCalledTimes(1)
        expect(reload).toHaveBeenCalledTimes(1)
      })
    })

    describe('a page that has just been opened, or has just come back to the front', () => {
      // Each deploy is a new version, and a page opened later still starts with the old one the browser kept. Nothing
      // has been done on the page yet, so it switches by itself at once.
      beforeEach(() => {
        resetUpdatesForTests({ reload, freshForMs: FRESH_FOR_MS })
        watchForUpdates({ enabled: true })
      })
      afterEach(() => window.history.replaceState(null, '', '/'))
      const comesBackToTheFront = () => document.dispatchEvent(new Event('visibilitychange')) // jsdom: the page is "visible"

      it('switches to the new version by itself', async () => {
        pwa.options.onRegisteredSW('/sw.js', waiting())

        pwa.options.onNeedRefresh()
        await vi.advanceTimersByTimeAsync(0)

        expect(pwa.updated).toBe(1)
        workers.dispatchEvent(new Event('controllerchange'))
        expect(reload).toHaveBeenCalledTimes(1)
      })

      it('also when the browser says so before the registration is known', async () => {
        pwa.options.onNeedRefresh()
        pwa.options.onRegisteredSW('/sw.js', waiting())
        await vi.advanceTimersByTimeAsync(0)

        expect(pwa.updated).toBe(1)
      })

      it('once the page has been open for a while, it waits for the next screen', async () => {
        await vi.advanceTimersByTimeAsync(FRESH_FOR_MS)
        pwa.options.onRegisteredSW('/sw.js', waiting())

        pwa.options.onNeedRefresh()
        await vi.advanceTimersByTimeAsync(0)
        expect(pwa.updated).toBe(0)
        expect(reload).not.toHaveBeenCalled()

        screenChanged()
        expect(pwa.updated).toBe(1)
      })

      it('a version that was waiting comes in when the app comes back to the front', async () => {
        await vi.advanceTimersByTimeAsync(FRESH_FOR_MS)
        pwa.options.onRegisteredSW('/sw.js', waiting())
        pwa.options.onNeedRefresh()
        expect(pwa.updated).toBe(0)

        comesBackToTheFront()

        expect(pwa.updated).toBe(1)
      })

      it('so does one found right after coming back (the check runs then)', async () => {
        await vi.advanceTimersByTimeAsync(FRESH_FOR_MS)
        pwa.options.onRegisteredSW('/sw.js', waiting())
        comesBackToTheFront()
        expect(pwa.updated).toBe(0) // nothing was waiting

        pwa.options.onNeedRefresh()
        await vi.advanceTimersByTimeAsync(0)

        expect(pwa.updated).toBe(1)
      })

      it.each(['/contar', '/admin/historias', '/admin/revision'])('on %s it waits until the person leaves the page', async (path) => {
        window.history.replaceState(null, '', path)
        pwa.options.onRegisteredSW('/sw.js', waiting())

        pwa.options.onNeedRefresh()
        await vi.advanceTimersByTimeAsync(0)
        comesBackToTheFront()
        screenChanged() // another screen of the same page (a step of the story, say)
        expect(pwa.updated).toBe(0)

        window.history.replaceState(null, '', '/')
        screenChanged()
        expect(pwa.updated).toBe(1)
      })

      it('without signal the page stays as it is, nothing to say to the person', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
        pwa.options.onRegisteredSW('/sw.js', waiting())

        pwa.options.onNeedRefresh()
        await vi.advanceTimersByTimeAsync(TAKEOVER_WAIT_MS)

        expect(pwa.updated).toBe(1)
        expect(reload).not.toHaveBeenCalled()
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

      it.each(['/contar', '/admin/historias', '/admin/revision'])('a tab on %s does not: somebody may be in the middle of a story', (path) => {
        window.history.replaceState(null, '', path)
        pwa.options.onRegisteredSW('/sw.js', waiting())

        deliver('actualizar')

        expect(reload).not.toHaveBeenCalled()
        expect(sessionStorage.getItem('agrocultura.actualizando')).toBeNull()
      })

      // When the new version takes over, the plugin reloads every tab that saw it arrive unless it is given
      // onNeedReload: that is how a tab in the middle of a story was being reloaded anyway.
      it('when the new version takes over, a tab that saw it arrive reloads to show it', () => {
        pwa.options.onRegisteredSW('/sw.js', waiting())
        pwa.options.onNeedRefresh()

        pwa.options.onNeedReload()

        expect(reload).toHaveBeenCalledTimes(1)
      })

      it.each(['/contar', '/admin/historias', '/admin/revision'])('but a tab on %s stays as it is, and switches once the person leaves it', async (path) => {
        window.history.replaceState(null, '', path)
        pwa.options.onRegisteredSW('/sw.js', { waiting: null, update: vi.fn().mockResolvedValue() }) // another tab switched already
        pwa.options.onNeedRefresh()

        pwa.options.onNeedReload()
        expect(reload).not.toHaveBeenCalled()

        window.history.replaceState(null, '', '/')
        screenChanged()
        await vi.advanceTimersByTimeAsync(0)
        expect(reload).toHaveBeenCalledTimes(1)
      })

      it('the tab that switches reloads only once, even on one of those pages', async () => {
        window.history.replaceState(null, '', '/contar')
        pwa.options.onRegisteredSW('/sw.js', waiting())
        pwa.options.onNeedRefresh()

        await applyUpdate()
        workers.dispatchEvent(new Event('controllerchange'))
        pwa.options.onNeedReload()

        expect(reload).toHaveBeenCalledTimes(1)
      })

      it('ignores anything else said on the channel', () => {
        deliver('otra cosa')

        expect(reload).not.toHaveBeenCalled()
      })

      it('after stepping aside, the page does not switch on its own and reloads once more when the new version is in', async () => {
        sessionStorage.setItem('agrocultura.actualizando', 'otra-vez')
        resetUpdatesForTestsKeepingMark()
        watchForUpdates({ enabled: true })
        const worker = waiting()
        pwa.options.onRegisteredSW('/sw.js', worker)
        pwa.options.onNeedRefresh()

        expect(pwa.updated).toBe(0)
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

      it('after stepping aside, if the new version never comes in, the page stays and switches at the next safe moment', () => {
        sessionStorage.setItem('agrocultura.actualizando', 'otra-vez')
        resetUpdatesForTestsKeepingMark()
        watchForUpdates({ enabled: true })
        pwa.options.onRegisteredSW('/sw.js', waiting())

        vi.advanceTimersByTime(FINISHING_FOR_MS + LOOK_EVERY_MS)
        pwa.options.onNeedRefresh()
        expect(reload).not.toHaveBeenCalled()

        screenChanged()
        expect(pwa.updated).toBe(1)
      })
    })

    it('reloads at once when nothing is waiting any more (another tab already switched)', async () => {
      pwa.options.onRegisteredSW('/sw.js', { waiting: null, update: vi.fn().mockResolvedValue() })
      pwa.options.onNeedRefresh()

      await applyUpdate()

      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('a switch under way is not started again', async () => {
      pwa.options.onRegisteredSW('/sw.js', waiting())
      pwa.options.onNeedRefresh()

      await applyUpdate()
      await applyUpdate()
      screenChanged()

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
