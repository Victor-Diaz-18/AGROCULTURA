import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR } from './test/auth.js'
import { expectAccessible } from './test/axe.js'
import { adminStory, mapStory, storyCard, storyWithoutPlace } from './test/fixtures.js'
import { mockMapSize } from './test/layout.js'
import { renderApp } from './test/renderApp.jsx'

/** Accessibility (WCAG 2.2 AA), checked on the real pages with axe-core, plus what a keyboard and a screen reader need. */

vi.mock('./offline/media.js', () => ({ compressImage: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })) }))

const STORIES = [
  mapStory({ codigo: 'HIS-2026-001', titulo: 'El camino de mulas', lat: 11.14, lon: -74.118 }),
  mapStory({ codigo: 'HIS-2026-002', titulo: 'Cerca', lat: 11.1401, lon: -74.1181 }),
  mapStory({ codigo: 'HIS-2026-003', titulo: 'Muy cerca', lat: 11.1402, lon: -74.1179 }),
]

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  const restore = mockMapSize()
  return () => restore()
})

describe('every page passes axe', () => {
  it('the map, its filters, its list and a story card', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/historias': STORIES, '/historias/HIS-2026-001': storyCard() } })
    await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })
    await expectAccessible()

    await user.click(within(screen.getByRole('list', { name: 'Historias en esta zona del mapa' })).getAllByRole('button')[0])
    await screen.findByRole('dialog')
    await expectAccessible()
  })

  it('the map with a story that has no place: its list item and its card', async () => {
    const user = userEvent.setup()
    const noPlace = storyWithoutPlace({ codigo: 'HIS-2026-040', titulo: 'Lo que contaba mi abuela', narrador_nombre: 'Narrador anónimo', anonima: true, finca_nombre: 'Café La Loma' })
    renderApp({ api: { '/historias': [...STORIES, noPlace], '/historias/HIS-2026-040': storyCard({ ...noPlace, texto: 'Mi abuela decía que...', medios: [] }) } })
    const list = await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })
    expect(within(list).getByText('Sin ubicación en el mapa')).toBeInTheDocument()
    await expectAccessible()

    await user.click(within(list).getByRole('button', { name: /Lo que contaba mi abuela/ }))
    await screen.findByText('Esta historia no tiene ubicación en el mapa.')
    await expectAccessible()
  })

  it('the sign-in dialog, in its two forms (sign in and create an account)', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /Ingresar/ }))
    await screen.findByRole('dialog', { name: 'Ingresar' })
    await expectAccessible()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crea una' }))
    await screen.findByRole('dialog', { name: 'Crear cuenta' })
    await expectAccessible()
  })

  it('telling a story, in its three steps', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/contar', user: NARRATOR, api: { '/historias/mias': [] } })
    await screen.findByLabelText('O escríbela')
    await expectAccessible()

    await user.type(screen.getByLabelText('O escríbela'), 'Un recuerdo.')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByLabelText('Ponle un título')
    await expectAccessible()

    await user.type(screen.getByLabelText('Ponle un título'), 'Mi historia')
    await user.click(screen.getByRole('button', { name: 'Minca' }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), 'Antes de 1960')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByText('REVISA ANTES DE ENVIAR')
    await expectAccessible()

    // the last step with its boxes in use: without the name, and the authorization ticked
    await user.click(screen.getByRole('checkbox', { name: 'Publicar sin mi nombre' }))
    await user.click(screen.getByRole('checkbox', { name: /^Autorizo que mi historia se publique sin mi nombre/ }))
    await expectAccessible()
  })

  it('telling a story without a place: the two options and the reference instead of the map', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/contar', user: NARRATOR, api: { '/historias/mias': [] } })
    await user.type(await screen.findByLabelText('O escríbela'), 'Un recuerdo.')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByLabelText('Ponle un título')

    await user.click(screen.getByRole('radio', { name: 'Sin ubicación' }))
    await user.type(screen.getByLabelText(/Nombre de la finca o marca/), 'Café La Loma')

    expect(screen.getByLabelText(/Nombre de referencia/)).toBeInTheDocument()
    await expectAccessible()
  })

  it('"Mis historias", with its table', async () => {
    renderApp({ route: '/mis-historias', user: NARRATOR, api: { '/historias/mias': [{ codigo: 'HIS-2026-001', titulo: 'Una', sector_id: 'minca', epoca: 'Antes de 1960', formatos: ['Texto'], estado: 'revision', motivo_rechazo: null, enviada_en: '2026-09-14T15:20:00Z' }] } })
    await screen.findByText('Una')
    await expectAccessible()
  })

  it('the sign-in card of the administration, with its own main area', async () => {
    renderApp({ route: '/admin' })
    await screen.findByRole('heading', { name: 'Acceso del equipo' })

    expect(screen.getByRole('main')).toBeInTheDocument()
    await expectAccessible()
  })

  it('the administration: summary, review, project stories and settings', async () => {
    for (const route of ['/admin', '/admin/revision', '/admin/historias', '/admin/configuracion']) {
      const { unmount } = renderApp({ route, user: ADMIN, api: { '/admin/historias': [adminStory()] } })
      await screen.findByRole('main')
      await waitFor(() => expect(document.querySelector('h1')).not.toBeNull())
      await expectAccessible()
      unmount()
    }
  })

  it('the review dialog', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/admin/revision', user: ADMIN, api: { '/admin/historias': [adminStory({ estado: 'revision', origen: 'comunidad' })] } })
    await user.click(await screen.findByRole('button', { name: /^Revisar/ }))
    await screen.findByRole('dialog')
    await expectAccessible()
  })
})

describe('the map’s groups of stories', () => {
  it('are one button each, with the whole sentence, and no button inside a button', async () => {
    renderApp({ api: { '/historias': STORIES } })

    const group = await screen.findByRole('button', { name: /historias juntas: toca para acercar/ })

    expect(group).toHaveTextContent('historias juntas')
    expect(group.querySelector('button')).toBeNull()
    expect(group.querySelector('[aria-hidden="true"]')).toHaveTextContent('3')
  })
})

describe('a keyboard and a screen reader', () => {
  it('start with "Saltar al contenido", which goes to the main area', async () => {
    renderApp()

    const skip = await screen.findByRole('link', { name: 'Saltar al contenido' })

    expect(skip).toHaveAttribute('href', '#contenido')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenido')
  })

  it('each page names the tab: "Mis historias · AGROCULTURA"', async () => {
    renderApp({ route: '/mis-historias', user: NARRATOR, api: { '/historias/mias': [] } })

    await waitFor(() => expect(document.title).toBe('Mis historias · AGROCULTURA'))
  })

  it('the title follows the portal’s name', async () => {
    renderApp({ route: '/mis-historias', user: NARRATOR, api: { '/historias/mias': [], '/config': { ...(await import('./test/fixtures.js')).CONFIG, portal: { ...(await import('./test/fixtures.js')).CONFIG.portal, nombre: 'Memoria de Minca' } } } })

    await waitFor(() => expect(document.title).toBe('Mis historias · Memoria de Minca'))
  })

  it('moving to another page puts the focus on its heading, but opening the first one does not', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/mis-historias', user: NARRATOR, api: { '/historias/mias': [] } })
    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(document.body).toHaveFocus() // nothing was moved on arrival

    await user.click(screen.getByRole('link', { name: /Mapa de historias/ }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mapa de historias' })).toHaveFocus())
  })

  it('a dialog keeps Tab inside, in both directions, and gives the focus back when it closes', async () => {
    const user = userEvent.setup()
    renderApp()
    const opener = screen.getByRole('button', { name: /Ingresar/ })
    await user.click(opener)
    const dialog = await screen.findByRole('dialog')
    const controls = () => [...dialog.querySelectorAll('a[href], button, input, select, textarea')].filter((element) => !element.disabled)

    controls().at(-1).focus()
    await user.tab()
    expect(controls()[0]).toHaveFocus() // from the last control, Tab goes to the first, not to the page behind

    await user.tab({ shift: true })
    expect(controls().at(-1)).toHaveFocus() // and Shift+Tab goes back to the last

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })

  it('the map’s groups can be reached and opened with the keyboard', async () => {
    renderApp({ api: { '/historias': STORIES } })
    const group = await screen.findByRole('button', { name: /historias juntas/ })

    expect(group).toHaveAttribute('tabindex', '0')
  })
})
