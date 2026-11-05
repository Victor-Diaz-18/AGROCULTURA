import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR } from './test/auth.js'
import { adminStory, mapStory, storyCard } from './test/fixtures.js'
import { mockMapSize } from './test/layout.js'
import { renderApp } from './test/renderApp.jsx'

// The tests of the other files run with the design's feature codes on (so they can name things as the design does).
// This file runs as the people who use the platform see it: codes off, which is how the app is built unless asked.
vi.hoisted(() => {
  import.meta.env.VITE_SHOW_CODES = undefined
})

const CODE = /\bF(1[0-5]|[1-9])\b/ // F1 ... F15

/** Neither in what is read on the screen nor in what a screen reader or a tooltip says (names, titles, placeholders). */
const noCodes = () => {
  const spoken = [...document.body.querySelectorAll('[aria-label], [title], [placeholder], [alt]')].flatMap((element) =>
    ['aria-label', 'title', 'placeholder', 'alt'].map((name) => element.getAttribute(name)),
  )
  const found = [document.body.textContent, ...spoken].flatMap((text) => text?.match(new RegExp(CODE, 'g')) ?? [])
  expect(found, `the page shows the design codes: ${found.join(', ')}`).toEqual([])
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  const restore = mockMapSize()
  return () => restore()
})

describe('without VITE_SHOW_CODES the people who use the platform never see the design’s codes (F1, F2, ...)', () => {
  it('the map, its menu and its header, for a visitor', async () => {
    renderApp({ api: { '/historias': [mapStory()] } })
    await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })

    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: /Mapa de historias/ })).toBeInTheDocument()
    noCodes()
  })

  it('the counters of the map, for someone signed in', async () => {
    renderApp({ user: NARRATOR, api: { '/historias': [mapStory()] } })
    await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })

    expect(screen.getByText(/No salen en el mapa hasta que un administrador las aprueba\./)).toBeInTheDocument()
    noCodes()
  })

  it('the side menu says only what each section is, with no codes, also the ones that are coming', async () => {
    renderApp({ user: NARRATOR })
    const nav = await screen.findByRole('navigation', { name: 'Secciones' })

    expect(within(nav).getByRole('link', { name: 'Recorridos 360°' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Avatares en RA' })).toBeInTheDocument()
    expect(nav.querySelector('.ag-nav__code')).toBeNull()
    noCodes()
  })

  it('the sign-in dialog', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /Ingresar/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Ingresar' })
    expect(within(dialog).getByLabelText('Usuario')).toBeInTheDocument()
    noCodes()

    await user.click(within(dialog).getByRole('button', { name: 'Crea una' }))
    expect(await screen.findByRole('dialog', { name: 'Crear cuenta' })).toBeInTheDocument()
    noCodes()
  })

  it('telling a story, in its three steps', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/contar', user: NARRATOR, api: { '/historias/mias': [] } })
    await screen.findByLabelText('O escríbela')
    noCodes()

    await user.type(screen.getByLabelText('O escríbela'), 'Un recuerdo.')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByLabelText('Ponle un título')
    noCodes()

    await user.type(screen.getByLabelText('Ponle un título'), 'Mi historia')
    await user.click(screen.getByRole('button', { name: 'Minca' }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), 'Antes de 1960')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await screen.findByText('REVISA ANTES DE ENVIAR')
    expect(screen.getByText('Marca la autorización para poder enviarla.')).toBeInTheDocument()
    noCodes()
    await user.click(screen.getByRole('checkbox', { name: /^Autorizo que mi historia se publique/ }))
    expect(screen.getByText('Al enviarla pasa a revisión.')).toBeInTheDocument()
    noCodes()
  })

  it('"Mis historias"', async () => {
    renderApp({ route: '/mis-historias', user: NARRATOR, api: { '/historias/mias': [] } })
    await screen.findByRole('heading', { name: 'Mis historias' })
    noCodes()
  })

  it('a story card', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/historias': [mapStory()], '/historias/HIS-2026-001': storyCard() } })
    await user.click(within(await screen.findByRole('list', { name: 'Historias en esta zona del mapa' })).getByRole('button'))

    await screen.findByRole('dialog', { name: 'Ficha de la historia' })
    noCodes()
  })

  it('the pages that are coming: no code in the tag, the note or the list of what they depend on', async () => {
    renderApp({ route: '/proximamente/ra', user: ADMIN })

    expect(await screen.findByText('FASE FUTURA')).toBeInTheDocument()
    expect(screen.getByText(/Necesita contenido grabado con audio o video y se abriría desde la ficha\./)).toBeInTheDocument()
    expect(screen.getByText('Ficha de historia')).toBeInTheDocument()
    noCodes()
  })

  it('the administration, in the portal and in its own panel', async () => {
    for (const route of ['/revision', '/historias-propias', '/configuracion', '/admin', '/admin/revision', '/admin/historias', '/admin/configuracion', '/admin/proximamente/360']) {
      const { unmount } = renderApp({ route, user: ADMIN, api: { '/admin/historias': [adminStory()] } })
      await screen.findByRole('main')
      await screen.findByRole('heading', { level: 1 })
      noCodes()
      unmount()
    }
  })

  it('the review and the new team story dialogs', async () => {
    const user = userEvent.setup()
    const first = renderApp({ route: '/revision', user: ADMIN, api: { '/admin/historias': [adminStory()] } })
    await user.click(await screen.findByRole('button', { name: 'Revisar' }))
    await screen.findByRole('dialog')
    noCodes()
    first.unmount()

    renderApp({ route: '/historias-propias?nueva=1', user: ADMIN, api: { '/admin/historias': [] } })
    await screen.findByRole('dialog', { name: 'Nueva historia del proyecto' })
    noCodes()
  })
})
