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

  it('names the place a narrator gave, with its sector, and "Otro lugar de la zona" when there is neither', async () => {
    open([
      mapStory({ codigo: 'HIS-2026-001', titulo: 'Con nombre', lugar_nombre: 'Finca La Esperanza', sector_id: 'minca' }),
      mapStory({ codigo: 'HIS-2026-002', titulo: 'Sin nada', sector_id: null, lat: 11.141, lon: -74.119 }),
    ])

    expect(await screen.findByRole('button', { name: /Con nombre/ })).toHaveTextContent('Aurelio Martínez · Finca La Esperanza, Minca · Antes de 1960')
    expect(screen.getByRole('button', { name: /Sin nada/ })).toHaveTextContent('Aurelio Martínez · Otro lugar de la zona · Antes de 1960')
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
    expect(await screen.findByText('5 de la comunidad · 2 del proyecto')).toBeInTheDocument()
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

describe('Mapa de historias: filtros y búsqueda (F11)', () => {
  const STORIES = [
    mapStory({ codigo: 'HIS-2026-001', titulo: 'El camino de mulas', lat: 11.14, lon: -74.118, formatos: ['Audio', 'Foto'], etiquetas: ['#arriería'] }),
    mapStory({ codigo: 'HIS-2026-002', titulo: 'La primera cosecha', narrador_nombre: 'Rosa Elena Pérez', sector_id: 'la-tagua', epoca: '1960 a 1979', formatos: ['Foto', 'Audio'], lat: 11.13, lon: -74.087, etiquetas: ['#cosecha'] }),
    mapStory({ codigo: 'HIS-2026-004', titulo: 'El patio donde se secaba el café', narrador_nombre: 'Equipo AGROCULTURA', sector_id: 'tijereras', epoca: '1960 a 1979', formatos: ['Video', 'Foto'], origen: 'proyecto', lat: 11.109, lon: -74.111, etiquetas: ['#familia'] }),
    mapStory({ codigo: 'HIS-2026-005', titulo: 'Un secadero junto al río', narrador_nombre: 'Luz Marina Ospina', sector_id: null, epoca: '1980 a 1999', formatos: ['Texto'], lat: 11.2, lon: -74.2, etiquetas: [] }),
  ]
  const bar = () => within(screen.getByRole('group', { name: 'Filtrar por sector' }))
  const titles = () => within(listOf()).queryAllByRole('button').map((button) => button.querySelector('.ag-storyitem__title').textContent)
  const openFiltered = async () => {
    open(STORIES)
    await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })
  }
  const pins = () => screen.queryAllByRole('button', { name: /^Ver / }).length

  it('has the bar of the design: sectors with counts, origin, search, period and format', async () => {
    await openFiltered()

    const sectorsBar = bar()
    expect(sectorsBar.getByRole('button', { name: /^Todos\s*4$/ })).toHaveAttribute('aria-pressed', 'true')
    for (const [name, count] of [['Minca', 1], ['La Tagua', 1], ['San Lorenzo', 0], ['Tijereras', 1], ['Otro lugar', 1]]) {
      expect(sectorsBar.getByRole('button', { name: new RegExp(`^${name}\\s*${count}$`) })).toBeInTheDocument()
    }
    const origins = within(screen.getByRole('group', { name: 'Filtrar por origen' }))
    expect(origins.getAllByRole('button').map((button) => button.textContent)).toEqual(['Todas', 'Comunidad', 'Proyecto'])
    expect(screen.getByRole('searchbox', { name: 'Buscar historias' })).toHaveAttribute('placeholder', 'Buscar por título, narrador o etiqueta…')
    expect(screen.getByRole('combobox', { name: 'Época' })).toHaveValue('todas')
    expect(screen.getByRole('combobox', { name: 'Formato' })).toHaveValue('todos')
  })

  it('"Otro lugar" is only offered when some story is in no sector', async () => {
    open(STORIES.filter((story) => story.sector_id))
    await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })

    expect(bar().queryByRole('button', { name: /Otro lugar/ })).not.toBeInTheDocument()
  })

  it('a sector tab leaves only that sector, on the map and in the list', async () => {
    const user = userEvent.setup()
    await openFiltered()
    expect(pins()).toBe(4)

    await user.click(bar().getByRole('button', { name: /^La Tagua/ }))

    expect(titles()).toEqual(['La primera cosecha'])
    expect(pins()).toBe(1)
    expect(bar().getByRole('button', { name: /^La Tagua/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('"Otro lugar" shows the stories that are in no sector', async () => {
    const user = userEvent.setup()
    await openFiltered()

    await user.click(bar().getByRole('button', { name: /^Otro lugar/ }))

    expect(titles()).toEqual(['Un secadero junto al río'])
  })

  it('the origin tabs show only the community or only the project', async () => {
    const user = userEvent.setup()
    await openFiltered()
    const origins = within(screen.getByRole('group', { name: 'Filtrar por origen' }))

    await user.click(origins.getByRole('button', { name: 'Proyecto' }))
    expect(titles()).toEqual(['El patio donde se secaba el café'])

    await user.click(origins.getByRole('button', { name: 'Comunidad' }))
    expect(titles()).toHaveLength(3)
    expect(titles()).not.toContain('El patio donde se secaba el café')
  })

  it('the search looks in the title, the narrator and the tags, with no care for accents, and waits for the typing to stop', async () => {
    const user = userEvent.setup()
    await openFiltered()
    const search = screen.getByRole('searchbox', { name: 'Buscar historias' })

    await user.type(search, 'cafe') // the title says "café"
    await waitFor(() => expect(titles()).toEqual(['El patio donde se secaba el café']))

    await user.clear(search)
    await user.type(search, 'perez')
    await waitFor(() => expect(titles()).toEqual(['La primera cosecha']))

    await user.clear(search)
    await user.type(search, '#arrieria')
    await waitFor(() => expect(titles()).toEqual(['El camino de mulas']))
  })

  it('the period and the format menus filter too', async () => {
    const user = userEvent.setup()
    await openFiltered()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Época' }), '1960 a 1979')
    expect(titles().sort()).toEqual(['El patio donde se secaba el café', 'La primera cosecha'])

    await user.selectOptions(screen.getByRole('combobox', { name: 'Formato' }), 'Video')
    expect(titles()).toEqual(['El patio donde se secaba el café'])
  })

  it('the numbers of the sector tabs follow the other filters', async () => {
    const user = userEvent.setup()
    await openFiltered()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Formato' }), 'Video')

    expect(bar().getByRole('button', { name: /^Todos\s*1$/ })).toBeInTheDocument()
    expect(bar().getByRole('button', { name: /^Tijereras\s*1$/ })).toBeInTheDocument()
    expect(bar().getByRole('button', { name: /^Minca\s*0$/ })).toBeInTheDocument()
  })

  it('says so when nothing matches, and "Quitar los filtros" brings everything back', async () => {
    const user = userEvent.setup()
    await openFiltered()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar historias' }), 'zzz')
    await user.click(bar().getByRole('button', { name: /^Minca/ }))

    expect(await screen.findByText('No hay historias con estos filtros')).toBeInTheDocument()
    expect(screen.getByText('Prueba con otro sector, otra época o borra la búsqueda.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar los filtros' }))

    expect(titles()).toHaveLength(4)
    expect(screen.getByRole('searchbox', { name: 'Buscar historias' })).toHaveValue('')
    expect(bar().getByRole('button', { name: /^Todos/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Quitar los filtros' })).not.toBeInTheDocument()
  })

  it('a story that is marked and then filtered out is not marked any more', async () => {
    const user = userEvent.setup()
    await openFiltered()
    await user.click(within(listOf()).getByRole('button', { name: /El camino de mulas/ }))
    await user.click(await screen.findByRole('button', { name: 'Cerrar' }))
    expect(within(listOf()).getByRole('button', { name: /El camino de mulas/ })).toHaveAttribute('aria-current', 'true')

    await user.click(bar().getByRole('button', { name: /^La Tagua/ }))
    await user.click(bar().getByRole('button', { name: /^Todos/ }))

    expect(within(listOf()).getByRole('button', { name: /El camino de mulas/ })).not.toHaveAttribute('aria-current')
  })

  it('works without signal, over the stories the phone kept', async () => {
    const user = userEvent.setup()
    await openFiltered()
    act(() => toggleSimulatedOffline())

    await user.click(bar().getByRole('button', { name: /^Tijereras/ }))

    expect(titles()).toEqual(['El patio donde se secaba el café'])
  })
})
