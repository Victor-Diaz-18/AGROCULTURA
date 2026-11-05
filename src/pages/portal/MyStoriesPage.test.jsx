import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setSimulatedOffline, toggleSimulatedOffline } from '../../offline/connectivity.js'
import { cacheGet, cacheSet, listQueued, queueStory } from '../../offline/store.js'
import { NARRATOR } from '../../test/auth.js'
import { queuedDraft, storyCard } from '../../test/fixtures.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'
import { nextStep } from './MyStoriesPage.jsx'
import { put } from '@vercel/blob/client'

vi.mock('@vercel/blob/client', () => ({ put: vi.fn() }))

const story = (overrides) => ({
  codigo: 'HIS-2026-001',
  titulo: 'El camino de mulas',
  sector_id: 'minca',
  epoca: 'Antes de 1960',
  formatos: ['Audio', 'Foto'],
  estado: 'revision',
  motivo_rechazo: null,
  enviada_en: '2026-09-14T15:20:00Z',
  ...overrides,
})

const MINE = [
  story(),
  story({ codigo: 'HIS-2026-002', titulo: 'La trilla', sector_id: 'la-tagua', formatos: ['Texto'], estado: 'publicada' }),
  story({
    codigo: 'HIS-2026-003',
    titulo: 'Una receta',
    estado: 'rechazada',
    motivo_rechazo: 'Fuera del tema: no trata de la cultura cafetera',
  }),
]

const open = (mine = MINE) => renderApp({ route: '/mis-historias', user: NARRATOR, api: { '/historias/mias': mine } })
const tableRows = () => within(screen.getByRole('table', { name: 'Mis historias' })).getAllByRole('row').slice(1)

describe('Mis historias (F10, F6)', () => {
  it('lists each story with its code, sector, formats, date, state and what comes next', async () => {
    open()

    const first = (await screen.findByText('El camino de mulas')).closest('[role=row]')
    expect(within(first).getByText('HIS-2026-001')).toBeInTheDocument()
    expect(within(first).getByText('Minca')).toBeInTheDocument()
    expect(within(first).getByText('Audio · Foto')).toBeInTheDocument()
    expect(within(first).getByText('14 sep 2026')).toBeInTheDocument()
    expect(within(first).getByText('En revisión')).toBeInTheDocument()
    expect(within(first).getByText('Lo revisa un administrador')).toBeInTheDocument()
  })

  it('shows the reason a story was not published, in the narrator’s words', async () => {
    open()

    const rejected = (await screen.findByText('Una receta')).closest('[role=row]')
    expect(within(rejected).getByText('No publicada')).toBeInTheDocument()
    expect(within(rejected).getByText('Fuera del tema: no trata de la cultura cafetera')).toBeInTheDocument()
  })

  it('counts the stories by state and filters by it', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByText('El camino de mulas')
    const tabs = screen.getByRole('group', { name: 'Filtrar por estado' })

    expect(within(tabs).getByRole('button', { name: /^Todas\s*3$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(tabs).getByRole('button', { name: /^Borrador\s*0$/ })).toBeInTheDocument()

    await user.click(within(tabs).getByRole('button', { name: /^Publicada/ }))

    expect(tableRows()).toHaveLength(1)
    expect(screen.getByText('La trilla')).toBeInTheDocument()
    expect(screen.queryByText('El camino de mulas')).not.toBeInTheDocument()
  })

  it('says so when there is no story in the chosen state', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByText('El camino de mulas')

    await user.click(screen.getByRole('button', { name: /^Borrador/ }))

    expect(screen.getByText('No hay historias en este estado.')).toBeInTheDocument()
  })

  it('invites to tell the first story when there is none yet', async () => {
    open([])

    expect(await screen.findByText(/Todavía no has contado ninguna historia/)).toBeInTheDocument()
  })

  it('shows how many stories the narrator has next to "Mis historias" in the menu', async () => {
    open()

    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    expect(await within(nav).findByText('3')).toBeInTheDocument()
  })

  it('forgets the list when the narrator signs out, so nobody sees another person’s stories', async () => {
    const user = userEvent.setup()
    open()
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    expect(await within(nav).findByText('3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByText('Sesión cerrada.')).toBeInTheDocument()
    expect(within(nav).queryByText('3')).not.toBeInTheDocument()
    expect(screen.queryByText('El camino de mulas')).not.toBeInTheDocument()
  })

  it('"Contar otra historia" opens the form', async () => {
    const user = userEvent.setup()
    open()

    await user.click(screen.getByRole('button', { name: 'Contar otra historia' }))

    expect(await screen.findByRole('heading', { name: 'Contar una historia' })).toBeInTheDocument()
  })

  it('offers to try again when the list could not be loaded', async () => {
    const user = userEvent.setup()
    let attempts = 0
    renderApp({
      route: '/mis-historias',
      user: NARRATOR,
      api: { '/historias/mias': () => (++attempts === 1 ? reply({ detail: 'Error' }, 500) : MINE) },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus historias.')
    await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))

    expect(await screen.findByText('El camino de mulas')).toBeInTheDocument()
  })

  it('keeps showing the last list when the signal drops, and says so', async () => {
    open()
    await screen.findByText('El camino de mulas')

    act(() => toggleSimulatedOffline())

    expect(await screen.findByText('Sin señal.', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('El camino de mulas')).toBeInTheDocument()
  })

  it('only narrators can open it', () => {
    renderApp({ route: '/mis-historias' })

    expect(screen.queryByRole('heading', { name: 'Mis historias' })).not.toBeInTheDocument()
  })
})

describe('nextStep', () => {
  it('is the rejection reason for a rejected story and nothing for a published one', () => {
    expect(nextStep({ estado: 'rechazada', motivo_rechazo: 'Contenido incompleto o no se entiende' })).toBe(
      'Contenido incompleto o no se entiende',
    )
    expect(nextStep({ estado: 'rechazada', motivo_rechazo: null })).toBe('')
    expect(nextStep({ estado: 'publicada' })).toBe('')
    expect(nextStep({ estado: 'borrador' })).toBe('Se envía cuando haya señal')
  })
})

describe('Mis historias: ver la ficha', () => {
  it('only a published story has a card, and it opens from its row', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({
      route: '/mis-historias',
      user: NARRATOR,
      api: { '/historias/mias': MINE, '/historias/HIS-2026-002': storyCard({ codigo: 'HIS-2026-002', titulo: 'La trilla' }) },
    })
    const published = (await screen.findByText('La trilla')).closest('[role=row]')
    const waiting = screen.getByText('El camino de mulas').closest('[role=row]')
    const rejected = screen.getByText('Una receta').closest('[role=row]')

    expect(within(waiting).queryByRole('button', { name: 'Ver ficha' })).not.toBeInTheDocument()
    expect(within(rejected).queryByRole('button', { name: 'Ver ficha' })).not.toBeInTheDocument()
    await user.click(within(published).getByRole('button', { name: 'Ver ficha' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ficha de la historia' })
    expect(within(dialog).getByRole('heading', { name: 'La trilla' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/historias/HIS-2026-002')).toBe(true)
  })
})

describe('Mis historias: borradores en el dispositivo (F10)', () => {
  const saved = (overrides) => queueStory(queuedDraft(overrides))

  it('shows a story kept on the phone first, as a draft that goes out when there is signal', async () => {
    setSimulatedOffline(true)
    await saved()
    open()

    const rows = await waitFor(() => {
      const found = tableRows()
      expect(found[0]).toHaveTextContent('El camino de mulas')
      return found
    })
    expect(rows[0]).toHaveTextContent('Por asignar')
    expect(rows[0]).toHaveTextContent('Minca')
    expect(rows[0]).toHaveTextContent('Texto')
    expect(rows[0]).toHaveTextContent('Borrador')
    expect(rows[0]).toHaveTextContent('Se envía cuando haya señal')
  })

  it('counts drafts in the tab and in the menu, and filters by them', async () => {
    const user = userEvent.setup()
    setSimulatedOffline(true)
    await saved()
    open()
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    await within(nav).findByText('1')

    const tabs = screen.getByRole('group', { name: 'Filtrar por estado' })
    await user.click(within(tabs).getByRole('button', { name: /^Borrador\s*1$/ }))

    expect(tableRows()).toHaveLength(1)
    expect(tableRows()[0]).toHaveTextContent('El camino de mulas')
  })

  it('joins them with the stories the server has', async () => {
    await saved({ fallo: 'Pendiente' }) // refused earlier, so it stays a draft even with signal
    open()

    await screen.findByText('Por asignar')
    expect(await screen.findByText('La trilla')).toBeInTheDocument()
    expect(tableRows()).toHaveLength(4)
  })

  it('without signal, says the drafts are safe on the device', async () => {
    setSimulatedOffline(true)
    await saved()
    open()

    expect(await screen.findByText('Tus borradores están guardados en este dispositivo y se enviarán solos cuando vuelva la conexión.')).toBeInTheDocument()
  })

  it('does not show the drafts of another narrator', async () => {
    setSimulatedOffline(true)
    await saved({ narratorId: 'u2', titulo: 'De otra persona' })
    open()

    await screen.findByText('Sin señal.', { exact: false })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByText('De otra persona')).not.toBeInTheDocument()
  })

  it('a story the server refused shows why, and can be tried again', async () => {
    const user = userEvent.setup()
    await saved({ fallo: 'El audio pesa demasiado.' })
    const { fetchMock } = renderApp({
      route: '/mis-historias',
      user: NARRATOR,
      api: { '/historias/mias': [], '/historias': () => ({ codigo: 'HIS-2026-031', titulo: 'El camino de mulas', estado: 'revision' }) },
    })
    expect(await screen.findByText('El audio pesa demasiado.')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias')).toHaveLength(0) // not retried by itself

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Se envió 1 borrador a revisión.')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias')).toHaveLength(1)
  })

  it('a draft can be thrown away, after asking, because nobody else has a copy', async () => {
    const user = userEvent.setup()
    await saved({ fallo: 'El audio pesa demasiado.' })
    open([])
    await user.click(await screen.findByRole('button', { name: 'Quitar' }))

    const dialog = await screen.findByRole('dialog', { name: 'Quitar borrador' })
    expect(dialog).toHaveTextContent('todavía no se ha enviado')
    await user.click(within(dialog).getByRole('button', { name: 'No, dejarla' }))
    expect(screen.getByText('El camino de mulas')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Quitar borrador' })).getByRole('button', { name: 'Sí, quitarla' }))

    await waitFor(() => expect(screen.queryByText('El camino de mulas')).not.toBeInTheDocument())
    expect(await listQueued(NARRATOR.id)).toEqual([])
  })

  it('opened without signal, it shows the last list the server gave', async () => {
    await cacheSet(`mias:${NARRATOR.id}`, MINE)
    setSimulatedOffline(true)
    open()

    expect(await screen.findByText('La trilla')).toBeInTheDocument()
    expect(screen.getByText('Ves lo último que se cargó.', { exact: false })).toBeInTheDocument()
  })

  it('forgets that list when the narrator signs out', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByText('La trilla')
    await waitFor(async () => expect(await cacheGet(`mias:${NARRATOR.id}`)).not.toBeNull())

    await user.click(screen.getByRole('button', { name: 'Salir' }))

    await waitFor(async () => expect(await cacheGet(`mias:${NARRATOR.id}`)).toBeNull())
  })
})


describe('Mis historias: el video que falta subir (F13)', () => {
  const waiting = (overrides) =>
    queueStory(
      queuedDraft({
        clientId: 'video-0001',
        fase: 'video',
        codigo: 'HIS-2026-001',
        texto: '',
        formatos: ['Video'],
        video: { id: 'v1', name: 'video_01.mp4', mime: 'video/mp4', blob: new Blob(['clip'], { type: 'video/mp4' }) },
        ...overrides,
      }),
    )
  const firstRow = () => tableRows().find((row) => row.textContent.includes('HIS-2026-001'))

  beforeEach(() => put.mockReset().mockResolvedValue({ url: 'https://store1.public.blob.vercel-storage.com/historias/u1/video-x.mp4' }))

  it('says what is next for a story whose video is not up yet', () => {
    expect(nextStep(story({ video_pendiente: { fallo: null, progreso: null } }))).toBe('Lo revisa un administrador. Falta subir el video: se sube cuando haya señal.')
    expect(nextStep(story({ video_pendiente: { fallo: null, progreso: 40 } }))).toBe('Lo revisa un administrador. Subiendo el video… 40 %')
    expect(nextStep(story({ video_pendiente: { fallo: 'No pudimos subir el video.', progreso: null } }))).toBe('No pudimos subir el video.')
  })

  it('shows it in the story’s row, and the story is not counted as a draft', async () => {
    await cacheSet(`mias:${NARRATOR.id}`, MINE) // the last list the server gave
    setSimulatedOffline(true)
    await waiting()
    open()

    await waitFor(() => expect(firstRow()).toHaveTextContent('Falta subir el video: se sube cuando haya señal.'))
    expect(firstRow()).toHaveTextContent('En revisión') // the story itself is in
    const tabs = screen.getByRole('group', { name: 'Filtrar por estado' })
    expect(within(tabs).getByRole('button', { name: /^Borrador\s*0$/ })).toBeInTheDocument()
  })

  it('a video the server refused shows why, and can be tried again', async () => {
    const user = userEvent.setup()
    await waiting({ fallo: 'No pudimos subir el video. Revisa tu conexión y toca «Reintentar».' })
    const { fetchMock } = renderApp({
      route: '/mis-historias',
      user: NARRATOR,
      api: {
        '/historias/mias': MINE,
        '/blob-token': { type: 'blob.generate-client-token', clientToken: 'client-token-1' },
        '/historias/HIS-2026-001/video': { codigo: 'HIS-2026-001', titulo: 'x', estado: 'revision', enviada_en: '' },
      },
    })
    expect(await screen.findByText(/toca «Reintentar»/)).toBeInTheDocument()
    expect(put).not.toHaveBeenCalled() // not retried by itself

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Se subió el video de «El camino de mulas».')).toBeInTheDocument()
    expect(put).toHaveBeenCalledTimes(1)
    expect(callsTo(fetchMock, '/historias/HIS-2026-001/video').filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })

  it('the video can be thrown away, after asking, and the story stays', async () => {
    const user = userEvent.setup()
    await waiting({ fallo: 'Esta historia ya fue revisada: ya no se le puede agregar un video.' })
    open()
    await user.click(await screen.findByRole('button', { name: 'Quitar' }))

    const dialog = await screen.findByRole('dialog', { name: 'Quitar video' })
    expect(dialog).toHaveTextContent('la historia sigue en revisión pero sin video')
    await user.click(within(dialog).getByRole('button', { name: 'No, dejarlo' }))
    expect(screen.getByText(/ya no se le puede agregar un video/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Quitar video' })).getByRole('button', { name: 'Sí, quitarlo' }))

    await waitFor(() => expect(screen.queryByText(/ya no se le puede agregar un video/)).not.toBeInTheDocument())
    expect(await listQueued(NARRATOR.id)).toEqual([])
    expect(screen.getByText('El camino de mulas')).toBeInTheDocument() // the story is still there
  })
})

describe('Mis historias: sin ubicación y sin nombre', () => {
  it('says which stories will be published without the name and without a place', async () => {
    renderApp({
      route: '/mis-historias',
      user: NARRATOR,
      api: {
        '/historias/mias': [
          { codigo: 'HIS-2026-020', titulo: 'Sin nombre', sector_id: 'minca', lugar_nombre: null, epoca: 'Antes de 1960', formatos: ['Audio'], estado: 'revision', motivo_rechazo: null, enviada_en: '2026-11-04T10:00:00Z', anonima: true, ubicacion_modo: 'aproximada' },
          { codigo: 'HIS-2026-021', titulo: 'Sin lugar', sector_id: null, lugar_nombre: 'Finca Los Mangos', epoca: 'Antes de 1960', formatos: ['Texto'], estado: 'revision', motivo_rechazo: null, enviada_en: '2026-11-04T11:00:00Z', anonima: false, ubicacion_modo: 'ninguna' },
        ],
      },
    })

    const withoutName = (await screen.findByText('Sin nombre')).closest('[role=row]')
    expect(within(withoutName).getByText('Se publicará sin tu nombre')).toBeInTheDocument()
    const withoutPlace = screen.getByText('Sin lugar').closest('[role=row]')
    expect(within(withoutPlace).getByText('Sin ubicación en el mapa')).toBeInTheDocument()
    expect(withoutPlace).not.toHaveTextContent('Los Mangos') // even to its narrator the table does not repeat the reference
    expect(withoutPlace).not.toHaveTextContent('Se publicará sin tu nombre')
  })
})

