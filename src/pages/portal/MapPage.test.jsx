import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toggleSimulatedOffline } from '../../offline/connectivity.js'
import { STATS, mapStory, storyCard } from '../../test/fixtures.js'
import { mockMapSize } from '../../test/layout.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'

const NEAR = [
  mapStory({ codigo: 'HIS-2026-001', titulo: 'El camino de mulas', lat: 11.14, lon: -74.118 }),
  mapStory({ codigo: 'HIS-2026-002', titulo: 'La primera cosecha', narrador_nombre: 'Rosa Elena Pérez', sector_id: 'la-tagua', epoca: '1960 a 1979', formatos: ['Foto', 'Audio'], lat: 11.13, lon: -74.087 }),
  mapStory({ codigo: 'HIS-2026-004', titulo: 'El patio donde se secaba el café', narrador_nombre: 'Equipo AGROCULTURA', sector_id: 'tijereras', epoca: '1960 a 1979', formatos: ['Foto'], origen: 'proyecto', lat: 11.109, lon: -74.111, foto_url: 'https://s.public.blob.vercel-storage.com/historias/u/p.jpg' }),
]
const stats = { ...STATS, publicadas: 7, aprobadas_comunidad: 5, por_origen: { comunidad: 5, proyecto: 2 } }

let restore
beforeEach(() => {
  restore = mockMapSize()
})
afterEach(() => restore())

const open = (list = NEAR, extra = {}, route = '/') =>
  renderApp({
    route,
    api: {
      '/estadisticas': stats,
      '/historias': list,
      '/historias/HIS-2026-001': storyCard(),
      '/historias/HIS-2026-002': storyCard({ codigo: 'HIS-2026-002', titulo: 'La primera cosecha' }),
      ...extra,
    },
  })
const listOf = () => screen.getByRole('list', { name: 'Historias en esta zona del mapa' })

describe('Mapa de historias (F1)', () => {
  it('draws the published stories and lists the ones in the visible zone', async () => {
    open()

    const list = await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('HIS-2026-004') // newest code first, as in the design
    const first = within(list).getByRole('button', { name: /El camino de mulas/ })
    expect(first).toHaveTextContent('HIS-2026-001')
    expect(first).toHaveTextContent('Comunidad')
    expect(first).toHaveTextContent('Aurelio Martínez · Minca · Antes de 1960')
    expect(first).toHaveTextContent('AudioFoto')
    expect(within(list).getByRole('button', { name: /El patio/ })).toHaveTextContent('Proyecto')
    expect(await screen.findByRole('button', { name: 'Ver El camino de mulas' })).toBeInTheDocument()
  })

  it('shows the first photo of a story as its thumbnail', async () => {
    open()

    const item = await screen.findByRole('button', { name: /El patio/ })
    expect(item.querySelector('img')).toHaveAttribute('src', 'https://s.public.blob.vercel-storage.com/historias/u/p.jpg')
  })

  it('counts what is in view against all the published stories', async () => {
    open()

    expect(await screen.findByText('Mostrando 3 de 7 historias publicadas')).toBeInTheDocument()
    expect(screen.getByText(/Toca un punto del mapa o una historia de la lista/)).toBeInTheDocument()
  })

  it('says so when no story is in the zone shown', async () => {
    open([mapStory({ codigo: 'HIS-2026-001', lat: 11.14, lon: -74.118 }), mapStory({ codigo: 'HIS-2026-002', lat: 4.0, lon: -74.0 })])

    expect(await screen.findByText('No hay historias en esta zona del mapa')).toBeInTheDocument()
    expect(screen.getByText('Mueve o aleja el mapa para ver más.')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 0 de 7 historias publicadas')).toBeInTheDocument()
  })

  it('shows every story while the map cannot tell what it shows (no layout)', async () => {
    restore()
    open()

    expect(await within(await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })).findAllByRole('listitem')).toHaveLength(3)
  })

  it('opens the card of a story from the list, asking the server for it', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()

    await user.click(await screen.findByRole('button', { name: /El camino de mulas/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Ficha de la historia' })
    expect(within(dialog).getByRole('heading', { name: 'El camino de mulas hasta Santa Marta' })).toBeInTheDocument()
    expect(within(dialog).getByText(/Antes de que hubiera carretera/)).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias/HIS-2026-001')).toHaveLength(1)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the card from a pin and marks that story in the list', async () => {
    const user = userEvent.setup()
    open()

    await user.click(await screen.findByRole('button', { name: 'Ver La primera cosecha' }))

    expect(await screen.findByRole('dialog', { name: 'Ficha de la historia' })).toBeInTheDocument()
    expect(within(listOf()).getByRole('button', { name: /La primera cosecha/ })).toHaveAttribute('aria-current', 'true')
  })

  it('marks and brings into view the story of a "Ver en el mapa" link', async () => {
    open(NEAR, {}, '/?historia=HIS-2026-002')

    const item = await screen.findByRole('button', { name: /La primera cosecha/ })
    await waitFor(() => expect(item).toHaveAttribute('aria-current', 'true'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument() // it only marks it; the card is one more tap
    expect(document.querySelector('.ag-pin-tip')).toHaveTextContent('La primera cosecha')
  })

  it('ignores a link to a story that is not on the map', async () => {
    open(NEAR, {}, '/?historia=HIS-2026-999')

    await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })
    expect(document.querySelector('[aria-current=true]')).toBeNull()
  })

  it('invites to wait for the first story when there is none', async () => {
    open([])

    expect(await screen.findByText('Todavía no hay historias publicadas')).toBeInTheDocument()
  })

  it('says it is loading, and offers to try again when it fails', async () => {
    const user = userEvent.setup()
    let attempts = 0
    open(NEAR, { '/historias': () => (++attempts === 1 ? reply({ detail: 'Error' }, 500) : NEAR) })

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar las historias')
    await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))

    expect(await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })).toBeInTheDocument()
  })

  it('without signal and with nothing loaded it says so', async () => {
    act(() => toggleSimulatedOffline())
    open()

    expect(await screen.findByText('Las historias se cargan cuando vuelva la conexión.')).toBeInTheDocument()
  })

  it('keeps the live counters of the design', async () => {
    open()

    expect(await screen.findByText('Historias publicadas')).toBeInTheDocument()
    expect(screen.getByText('5 de la comunidad · 2 del proyecto')).toBeInTheDocument()
  })

  it('reads aloud how many stories are in the zone', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })

    await user.click(screen.getByRole('button', { name: 'Escuchar' }))

    expect(window.speechSynthesis.speak).toHaveBeenCalled()
    expect(window.speechSynthesis.speak.mock.calls.map(([u]) => u.text).join(' ')).toContain('En la zona que ves hay 3 historias.')
  })
})
