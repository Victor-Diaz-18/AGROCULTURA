import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { setSimulatedOffline } from './connectivity.js'
import { cacheGet, cacheSet } from './store.js'
import { CONFIG, STATS, mapStory } from '../test/fixtures.js'
import { mockMapSize } from '../test/layout.js'
import { NARRATOR } from '../test/auth.js'
import { renderApp } from '../test/renderApp.jsx'

/** Opening the app: what the phone remembers from the last time with signal (F10). */

describe('opening the app without signal', () => {
  it('uses the configuration and the counters seen last time', async () => {
    await cacheSet('portal', {
      config: { ...CONFIG, portal: { ...CONFIG.portal, nombre: 'Memoria de Minca' } },
      stats: { ...STATS, publicadas: 9 },
    })
    setSimulatedOffline(true)

    renderApp({ route: '/' })

    expect(await screen.findByText('Memoria de Minca')).toBeInTheDocument()
    expect(await screen.findByText('9 publicadas')).toBeInTheDocument()
  })

  it('lets the narrator fill the form with the sectors and tags of the last visit', async () => {
    await cacheSet('portal', { config: CONFIG, stats: STATS })
    setSimulatedOffline(true)

    renderApp({ route: '/contar', user: NARRATOR })

    const text = await screen.findByLabelText('O escríbela')
    expect(text).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Sin señal', { exact: false })).toBeInTheDocument())
  })

  it('draws the stories published seen last time', async () => {
    const restore = mockMapSize()
    try {
      await cacheSet('publicadas', [mapStory({ codigo: 'HIS-2026-001', titulo: 'El camino de mulas', lat: 11.14, lon: -74.118 })])
      setSimulatedOffline(true)

      renderApp({ route: '/' })

      const list = await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })
      expect(within(list).getByRole('button', { name: /El camino de mulas/ })).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('says there is nothing to show only when nothing was ever seen', async () => {
    setSimulatedOffline(true)

    renderApp({ route: '/' })

    expect(await screen.findByText('Las historias se cargan cuando vuelva la conexión.')).toBeInTheDocument()
  })
})

describe('with signal', () => {
  it('keeps the latest answers on the phone for the next visit', async () => {
    renderApp({ route: '/', api: { '/historias': [mapStory({ codigo: 'HIS-2026-001' })], '/estadisticas': { ...STATS, publicadas: 4 } } })

    await waitFor(async () => expect((await cacheGet('portal'))?.stats.publicadas).toBe(4))
    await waitFor(async () => expect((await cacheGet('publicadas'))?.[0].codigo).toBe('HIS-2026-001'))
  })

  it('shows what the server says, not an older copy', async () => {
    await cacheSet('portal', { config: CONFIG, stats: { ...STATS, publicadas: 1 } })

    renderApp({ route: '/', api: { '/estadisticas': { ...STATS, publicadas: 6 } } })

    expect(await screen.findByText('6 publicadas')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByText('6 publicadas')).toBeInTheDocument()
  })
})
