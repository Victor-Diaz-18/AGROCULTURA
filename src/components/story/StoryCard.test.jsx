import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { STATS, adminStory, mapStory, storyCard } from '../../test/fixtures.js'
import { mockMapSize } from '../../test/layout.js'
import { ADMIN } from '../../test/auth.js'
import { renderApp, reply } from '../../test/renderApp.jsx'

const AUDIO = 'https://s.public.blob.vercel-storage.com/historias/u/a.webm'
const PHOTO1 = 'https://s.public.blob.vercel-storage.com/historias/u/1.jpg'
const PHOTO2 = 'https://s.public.blob.vercel-storage.com/historias/u/2.jpg'

afterEach(() => vi.restoreAllMocks())

/** Opens a card the way a person does: from the map list. */
async function openCard(card, { list = [mapStory()], extra = {} } = {}) {
  const user = userEvent.setup()
  const restore = mockMapSize()
  const view = renderApp({ route: '/', api: { '/estadisticas': { ...STATS, publicadas: 1 }, '/historias': list, '/historias/HIS-2026-001': card, ...extra } })
  await user.click(await screen.findByRole('button', { name: /El camino de mulas/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Ficha de la historia' }, { timeout: 3000 })
  return { user, dialog, restore, ...view }
}

describe('Ficha de la historia (F8)', () => {
  it('shows the title, when, where, who tells it, when it was published and the text', async () => {
    const { dialog } = await openCard(storyCard())

    expect(await within(dialog).findByRole('heading', { name: 'El camino de mulas hasta Santa Marta' })).toBeInTheDocument()
    const facts = dialog.querySelector('dl')
    expect(facts).toHaveTextContent('OcurrióAntes de 1960')
    expect(facts).toHaveTextContent('LugarMinca')
    expect(facts).not.toHaveTextContent('zona de Minca')
    expect(facts).toHaveTextContent('NarraAurelio Martínez')
    expect(facts).toHaveTextContent('Publicada14 sep 2026')
    expect(within(dialog).getByText(/Antes de que hubiera carretera/)).toBeInTheDocument()
    expect(within(dialog).getByText('#oficios')).toBeInTheDocument()
    expect(within(dialog).getByText('HIS-2026-001')).toBeInTheDocument()
    expect(within(dialog).getByText('Comunidad')).toBeInTheDocument()
  })

  it('opens the point of the story in Google Maps and in Apple Maps, in another tab', async () => {
    const { dialog } = await openCard(storyCard({ titulo: 'La trilla del café', lat: 11.0829, lon: -74.045 }))

    const google = await within(dialog).findByRole('link', { name: 'Abrir en Google Maps' })
    const apple = within(dialog).getByRole('link', { name: 'Abrir en Apple Maps' })
    expect(google).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=11.0829,-74.045')
    expect(apple).toHaveAttribute('href', 'https://maps.apple.com/?ll=11.0829,-74.045&q=La%20trilla%20del%20caf%C3%A9')
    for (const link of [google, apple]) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('says "zona de Minca" for the other sectors, as the design does', async () => {
    const { dialog } = await openCard(storyCard({ sector_id: 'la-tagua' }))

    expect(await within(dialog).findByText('La Tagua, zona de Minca')).toBeInTheDocument()
  })

  it('shows a project story as the project\'s', async () => {
    const { dialog } = await openCard(storyCard({ origen: 'proyecto', narrador_nombre: 'Equipo AGROCULTURA' }))

    expect(await within(dialog).findByText('Proyecto')).toBeInTheDocument()
  })

  it('plays the audio of the story', async () => {
    const { dialog } = await openCard(storyCard({ medios: [{ tipo: 'audio', url: AUDIO, mime: 'audio/webm', duracion_s: 204 }] }))

    expect(await within(dialog).findByRole('button', { name: 'Escuchar el audio' })).toBeEnabled()
    expect(within(dialog).getByText('3:24')).toBeInTheDocument()
    expect(dialog.querySelector('audio')).toHaveAttribute('src', AUDIO)
  })

  it('shows the photo and lets the person switch between several', async () => {
    const { user, dialog } = await openCard(storyCard({ medios: [{ tipo: 'foto', url: PHOTO1 }, { tipo: 'foto', url: PHOTO2 }] }))

    const main = await within(dialog).findByRole('img', { name: 'Foto 1 de 2 de la historia' })
    expect(main).toHaveAttribute('src', PHOTO1)
    await user.click(within(dialog).getByRole('button', { name: 'Ver la foto 2' }))

    expect(within(dialog).getByRole('img', { name: 'Foto 2 de 2 de la historia' })).toHaveAttribute('src', PHOTO2)
    expect(within(dialog).getByRole('button', { name: 'Ver la foto 2' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the photo full size in another tab', async () => {
    const { dialog } = await openCard(storyCard({ medios: [{ tipo: 'foto', url: PHOTO1 }] }))

    const link = await within(dialog).findByRole('link', { name: 'Abrir la foto en otra pestaña' })
    expect(link).toHaveAttribute('href', PHOTO1)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('an example story has placeholders where its files would be, and says why the audio is off', async () => {
    const { dialog } = await openCard(storyCard({ medios: [{ tipo: 'foto' }, { tipo: 'audio', duracion_s: 188 }, { tipo: 'video' }] }))

    expect(await within(dialog).findByText('Foto de la historia')).toBeInTheDocument()
    expect(within(dialog).getByText(/Video de la historia/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Escuchar el audio' })).toBeDisabled()
    expect(within(dialog).getByText('Historia de ejemplo: no tiene archivo de audio.')).toBeInTheDocument()
  })

  it('plays a video that has a file', async () => {
    const { dialog } = await openCard(storyCard({ medios: [{ tipo: 'video', url: 'https://s.public.blob.vercel-storage.com/historias/u/v.mp4' }] }))

    expect(await within(dialog).findByLabelText('Video de la historia')).toHaveAttribute('src', expect.stringContaining('v.mp4'))
  })

  it('a story told only in audio has no text and still reads well', async () => {
    const { dialog } = await openCard(storyCard({ texto: '', medios: [{ tipo: 'audio', url: AUDIO, duracion_s: 30 }] }))

    expect(await within(dialog).findByRole('heading', { name: 'El camino de mulas hasta Santa Marta' })).toBeInTheDocument()
    expect(dialog.querySelector('.ag-card-story__text')).toBeNull()
  })

  it('reads the story aloud', async () => {
    const { user, dialog } = await openCard(storyCard())
    await within(dialog).findByRole('heading', { name: /camino de mulas/ })

    await user.click(within(dialog).getByRole('button', { name: 'Escuchar' }))

    const spoken = window.speechSynthesis.speak.mock.calls.map(([u]) => u.text).join(' ')
    expect(spoken).toContain('Ocurrió Antes de 1960, en Minca.')
    expect(spoken).toContain('Narra Aurelio Martínez.')
    expect(spoken).toContain('Antes de que hubiera carretera')
  })

  it('keeps 360° and augmented reality for the future, switched off', async () => {
    const { dialog } = await openCard(storyCard())

    expect(await within(dialog).findByRole('button', { name: /Ver en 360°/ })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: /Avatar en RA/ })).toBeDisabled()
    expect(within(dialog).getByText('360° y realidad aumentada quedan para fases futuras.')).toBeInTheDocument()
  })

  it('"Ver en el mapa" closes the card and marks the story on the map', async () => {
    const { user, dialog } = await openCard(storyCard())

    await user.click(await within(dialog).findByRole('button', { name: 'Ver en el mapa' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Historias en esta zona del mapa' })
    expect(within(list).getByRole('button', { name: /El camino de mulas/ })).toHaveAttribute('aria-current', 'true')
  })

  it('says so when the story is no longer published', async () => {
    const user = userEvent.setup()
    mockMapSize()
    renderApp({ route: '/', api: { '/estadisticas': STATS, '/historias': [mapStory()], '/historias/HIS-2026-001': () => reply({ detail: 'No encontramos esa historia.' }, 404) } })

    await user.click(await screen.findByRole('button', { name: /El camino de mulas/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esa historia ya no está publicada.')
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says so when the card cannot be opened', async () => {
    const user = userEvent.setup()
    mockMapSize()
    renderApp({ route: '/', api: { '/estadisticas': STATS, '/historias': [mapStory()], '/historias/HIS-2026-001': () => reply({ detail: 'x' }, 500) } })

    await user.click(await screen.findByRole('button', { name: /El camino de mulas/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos abrir la ficha')
  })
})

describe('Ficha en el panel de administración', () => {
  const rejected = adminStory({ codigo: 'HIS-2026-012', titulo: 'Un viaje a la ciudad', estado: 'rechazada', motivo_rechazo: 'Fuera del tema: no trata de la cultura cafetera', medios: [] })

  it('a story that is on the map has its map buttons here too', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/admin/revision', user: ADMIN, api: { '/estadisticas': STATS, '/admin/historias': (_i, url) => (url.includes('estado=publicada') ? [adminStory({ codigo: 'HIS-2026-020', titulo: 'Publicada', estado: 'publicada', lat: 11.1, lon: -74.05 })] : []) } })
    await user.click(await screen.findByRole('button', { name: /Aprobadas/ }))

    await user.click(await screen.findByRole('button', { name: 'Ver ficha' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ficha de la historia' })
    expect(within(dialog).getByRole('link', { name: 'Abrir en Google Maps' })).toHaveAttribute('href', expect.stringContaining('11.1,-74.05'))
  })

  it('shows a story that was not published without a map button and with "Sin publicar"', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/admin/revision', user: ADMIN, api: { '/estadisticas': STATS, '/admin/historias': (_i, url) => (url.includes('estado=rechazada') ? [rejected] : []) } })
    await user.click(await screen.findByRole('button', { name: /Rechazadas/ }))

    await user.click(await screen.findByRole('button', { name: 'Ver ficha' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ficha de la historia' })
    expect(within(dialog).getByRole('heading', { name: 'Un viaje a la ciudad' })).toBeInTheDocument()
    expect(within(dialog).getByText('Sin publicar')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Ver en el mapa' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: /Abrir en/ })).not.toBeInTheDocument()
  })
})
