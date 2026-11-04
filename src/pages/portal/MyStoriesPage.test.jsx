import { describe, expect, it } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toggleSimulatedOffline } from '../../offline/connectivity.js'
import { NARRATOR } from '../../test/auth.js'
import { renderApp, reply } from '../../test/renderApp.jsx'
import { nextStep } from './MyStoriesPage.jsx'

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
