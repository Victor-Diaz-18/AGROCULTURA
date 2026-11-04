import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toggleSimulatedOffline } from '../../offline/connectivity.js'
import { NARRATOR } from '../../test/auth.js'
import { installFakeRecording } from '../../test/fakeMedia.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'
import { SEND_MESSAGES } from './TellPage.jsx'

vi.mock('../../offline/media.js', () => ({
  compressImage: vi.fn(async () => new Blob(['reduced-photo'], { type: 'image/jpeg' })),
}))

const AUDIO_URL = 'https://store1.public.blob.vercel-storage.com/historias/u1/audio-x1.webm'
const PHOTO_URL = 'https://store1.public.blob.vercel-storage.com/historias/u1/foto_01-x2.jpg'

const created = { codigo: 'HIS-2026-013', titulo: 'El camino de mulas', estado: 'revision', enviada_en: '2026-11-04T10:00:00Z' }
const uploadAnswer = (init) => {
  const kind = init.body.get('tipo')
  return kind === 'audio'
    ? { tipo: 'audio', url: AUDIO_URL, mime: 'audio/webm', bytes: 900, duracion_s: 1 }
    : { tipo: 'foto', url: PHOTO_URL, mime: 'image/jpeg', bytes: 700 }
}

const nextButton = () => screen.getByRole('button', { name: /^(Siguiente|Enviar historia|Enviando…)$/ })

function open(api = {}) {
  return renderApp({
    route: '/contar',
    user: NARRATOR,
    api: { '/historias': () => created, '/historias/mias': [], '/medios': uploadAnswer, ...api },
  })
}

async function writeStory(user, text = 'Antes de que hubiera carretera, el café bajaba en mula.') {
  await user.type(screen.getByLabelText('O escríbela'), text)
  await user.click(nextButton())
}

async function fillWhereAndWhen(user, { title = 'El camino de mulas', sector = 'Minca', epoca = 'Antes de 1960' } = {}) {
  await user.type(screen.getByLabelText('Ponle un título'), title)
  if (sector) await user.click(screen.getByRole('button', { name: sector }))
  if (epoca) await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), epoca)
}

const sentBody = (fetchMock) => JSON.parse(callsTo(fetchMock, '/historias')[0][1].body)

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('Contar una historia: steps and gating (F3)', () => {
  it('starts on step 1 and will not go on until the story is told or written', async () => {
    const user = userEvent.setup()
    open()

    expect(screen.getByRole('heading', { name: 'Contar una historia' })).toBeInTheDocument()
    expect(screen.getByText('Cuéntala').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(nextButton()).toBeDisabled()
    expect(screen.getByText('Graba un audio o escribe la historia para seguir.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('O escríbela'), 'Mi abuelo sembró el primer cafetal.')

    expect(nextButton()).toBeEnabled()
  })

  it('does not count a text of only spaces', async () => {
    const user = userEvent.setup()
    open()

    await user.type(screen.getByLabelText('O escríbela'), '     ')

    expect(nextButton()).toBeDisabled()
  })

  it('step 2 needs a title, a sector and a period', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)

    expect(screen.getByText('Dónde y cuándo').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Cuéntala').closest('li')).toHaveTextContent('✓')
    expect(nextButton()).toBeDisabled()
    expect(screen.getByText('Falta el título, el sector o la época.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Ponle un título'), 'El camino de mulas')
    await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), 'Antes de 1960')
    expect(nextButton()).toBeDisabled() // still no place

    await user.click(screen.getByRole('button', { name: 'Minca' }))
    expect(nextButton()).toBeEnabled()
    expect(screen.getByText('Todo listo para revisar.')).toBeInTheDocument()
  })

  it('can go back without losing what was written', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user, 'Un texto que no debe perderse.')

    await user.click(screen.getByRole('button', { name: 'Atrás' }))

    expect(screen.getByLabelText('O escríbela')).toHaveValue('Un texto que no debe perderse.')
  })

  it('shows the story taking shape in the side summary', async () => {
    const user = userEvent.setup()
    open()
    const summary = screen.getByRole('complementary', { name: 'Resumen de tu historia' })
    expect(summary).toHaveTextContent('Sin título todavía')
    expect(summary).toHaveTextContent('Formatos: Ninguno todavía')

    await writeStory(user)
    await fillWhereAndWhen(user, { sector: 'La Tagua', epoca: '1960 a 1979' })

    expect(summary).toHaveTextContent('El camino de mulas')
    expect(summary).toHaveTextContent('Lugar: La Tagua')
    expect(summary).toHaveTextContent('Época: 1960 a 1979')
    expect(summary).toHaveTextContent('Formatos: Texto')
  })

  it('limits the tags to six', async () => {
    const user = userEvent.setup()
    open({ '/config': { portal: {}, sectores: [], epocas: [], motivos_rechazo: [], etiquetas: ['#a', '#b', '#c', '#d', '#e', '#f', '#g'] } })
    await writeStory(user)

    for (const tag of ['#a', '#b', '#c', '#d', '#e', '#f', '#g']) await user.click(await screen.findByRole('button', { name: tag }))

    expect(screen.getAllByRole('button', { pressed: true }).filter((button) => button.className.includes('ag-chip'))).toHaveLength(6)
    expect(screen.getByRole('button', { name: '#g' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Contar una historia: el lugar puede ser cualquiera de la zona', () => {
  const setPosition = (latitude, longitude) =>
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (ok) => ok({ coords: { latitude, longitude } }) }, configurable: true })
  afterEach(() => delete navigator.geolocation)

  it('a place far from every sector is fine: it is told as "Otro lugar de la zona" and sent as a point', async () => {
    const user = userEvent.setup()
    setPosition(11.2, -73.95)
    const { fetchMock } = open()
    await writeStory(user)
    await user.type(screen.getByLabelText('Ponle un título'), 'Un camino de herradura')
    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), 'Antes de 1960')

    expect(nextButton()).toBeEnabled() // no sector needed
    expect(screen.getByRole('complementary', { name: 'Resumen de tu historia' })).toHaveTextContent('Lugar: Otro lugar de la zona')
    await user.click(nextButton())
    expect(screen.getByText(/Otro lugar de la zona · Antes de 1960/)).toBeInTheDocument()
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(sentBody(fetchMock)).toMatchObject({ ubicacion: { lat: 11.2, lon: -73.95 }, ubicacion_origen: 'gps' })
    expect(sentBody(fetchMock)).not.toHaveProperty('sector_id')
  })

  it('the place can be given a name, and it goes with the story', async () => {
    const user = userEvent.setup()
    setPosition(11.0835, -74.045)
    const { fetchMock } = open()
    await writeStory(user)
    await user.type(screen.getByLabelText('Ponle un título'), 'La trilla')
    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), 'Antes de 1960')

    await user.type(screen.getByLabelText(/Nombre del lugar/), '  Finca La Esperanza ')

    expect(screen.getByRole('complementary', { name: 'Resumen de tu historia' })).toHaveTextContent('Lugar: Finca La Esperanza, La Tagua')
    await user.click(nextButton())
    await user.click(nextButton())
    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(sentBody(fetchMock)).toMatchObject({ lugar_nombre: 'Finca La Esperanza' })
  })

  it('the name of the place is optional: nothing is sent when it is left empty', async () => {
    const user = userEvent.setup()
    setPosition(11.0835, -74.045)
    const { fetchMock } = open()
    await writeStory(user)
    await user.type(screen.getByLabelText('Ponle un título'), 'La trilla')
    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), 'Antes de 1960')

    await user.click(nextButton())
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(sentBody(fetchMock)).not.toHaveProperty('lugar_nombre')
  })

  it('tells the narrator that the public map shows only an approximate point', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)

    expect(screen.getByText(/en el mapa público se ve un punto aproximado/)).toBeInTheDocument()
  })

  it('a place near a sector is told with its name', async () => {
    const user = userEvent.setup()
    setPosition(11.0835, -74.045)
    open()
    await writeStory(user)
    await user.type(screen.getByLabelText('Ponle un título'), 'La trilla')

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(screen.getByRole('complementary', { name: 'Resumen de tu historia' })).toHaveTextContent('Lugar: La Tagua')
  })

  it('a position outside the zone is not taken: the person is asked to choose another place', async () => {
    const user = userEvent.setup()
    setPosition(4.7, -74.07)
    open()
    await writeStory(user)
    await user.type(screen.getByLabelText('Ponle un título'), 'Desde lejos')
    await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), 'Antes de 1960')

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(screen.getByText(/queda lejos de Minca y sus sectores/)).toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
  })
})

describe('Contar una historia: sending (F3, F5, F4)', () => {
  it('sends a written story for review and goes to "Mis historias"', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await writeStory(user)
    await fillWhereAndWhen(user)
    await user.click(nextButton())

    expect(screen.getByText('REVISA ANTES DE ENVIAR')).toBeInTheDocument()
    expect(screen.getByText('Hay señal')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias')).toHaveLength(0) // nothing leaves the phone before the last button
    await user.click(nextButton())

    expect(await screen.findByRole('heading', { name: 'Mis historias' })).toBeInTheDocument()
    expect(screen.getByText(SEND_MESSAGES.done)).toBeInTheDocument()
    const body = sentBody(fetchMock)
    expect(body).toMatchObject({
      titulo: 'El camino de mulas',
      texto: 'Antes de que hubiera carretera, el café bajaba en mula.',
      epoca: 'Antes de 1960',
      ubicacion: { lat: 11.14, lon: -74.118 },
      ubicacion_origen: 'sector',
      etiquetas: ['#café'], // the design's default when no tag is chosen
      medios: [],
    })
    expect(body.client_id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(callsTo(fetchMock, '/medios')).toHaveLength(0)
  })

  it('sends the tags that were chosen', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await writeStory(user)
    await fillWhereAndWhen(user)
    await user.click(screen.getByRole('button', { name: '#familia' }))
    await user.click(screen.getByRole('button', { name: '#cosecha' }))
    await user.click(nextButton())
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(sentBody(fetchMock).etiquetas).toEqual(['#familia', '#cosecha'])
  })

  it('records the voice, uploads the audio first and then creates the story with it', async () => {
    const user = userEvent.setup()
    installFakeRecording()
    const { fetchMock } = open()

    await user.click(screen.getByRole('button', { name: 'Grabar tu historia' }))
    expect(await screen.findByText(/^Grabando…/)).toBeInTheDocument()
    expect(nextButton()).toBeEnabled() // recording counts: Siguiente stops it
    await user.click(screen.getByRole('button', { name: 'Terminar de grabar' }))
    expect(await screen.findByText(/^Audio grabado/)).toBeInTheDocument()
    await user.click(nextButton())
    await fillWhereAndWhen(user)
    await user.click(nextButton())
    expect(screen.getByText('Historia contada en audio. La transcripción se agrega después.')).toBeInTheDocument()
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    const uploads = callsTo(fetchMock, '/medios')
    expect(uploads).toHaveLength(1)
    expect(uploads[0][1].body.get('tipo')).toBe('audio')
    expect(sentBody(fetchMock)).toMatchObject({
      texto: '',
      medios: [{ tipo: 'audio', url: AUDIO_URL, mime: 'audio/webm', bytes: 900, duracion_s: 1 }],
    })
  })

  it('tapping Siguiente while recording stops the recording and keeps the audio', async () => {
    const user = userEvent.setup()
    const { tracksStop } = installFakeRecording()
    open()

    await user.click(screen.getByRole('button', { name: 'Grabar tu historia' }))
    await screen.findByText(/^Grabando…/)
    await user.click(nextButton())

    expect(tracksStop).toHaveBeenCalled()
    expect(screen.getByRole('complementary', { name: 'Resumen de tu historia' })).toHaveTextContent(/Formatos: Audio 0:0\d/)
  })

  it('adds photos, shows them in the summary and sends them with the story', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()

    await user.upload(screen.getByLabelText('Elegir fotos'), [
      new File(['a'], 'IMG_1.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'IMG_2.jpg', { type: 'image/jpeg' }),
    ])
    expect(await screen.findByText(/^foto_01\.jpg/)).toBeInTheDocument()
    expect(screen.getByText(/^foto_02\.jpg/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar foto_02.jpg' }))
    expect(screen.queryByText(/^foto_02\.jpg/)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('O escríbela'), 'Las fotos de la finca.')
    await user.click(nextButton())
    await fillWhereAndWhen(user)
    await user.click(nextButton())
    expect(screen.getAllByText('1 foto')).toHaveLength(2) // the format chip and the side summary
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(callsTo(fetchMock, '/medios')).toHaveLength(1)
    expect(sentBody(fetchMock).medios).toEqual([{ tipo: 'foto', url: PHOTO_URL, mime: 'image/jpeg', bytes: 700 }])
  })

  it('a failed send keeps everything, says so, and the retry does not upload the audio twice or duplicate the story', async () => {
    const user = userEvent.setup()
    installFakeRecording()
    let attempts = 0
    const { fetchMock } = open({
      '/historias': () => (++attempts === 1 ? reply({ detail: 'Algo falló en el servidor.' }, 500) : created),
    })

    await user.click(screen.getByRole('button', { name: 'Grabar tu historia' }))
    await user.click(await screen.findByRole('button', { name: 'Terminar de grabar' }))
    await user.click(nextButton())
    await fillWhereAndWhen(user)
    await user.click(nextButton())
    await user.click(nextButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo falló en el servidor.')
    expect(screen.getByRole('button', { name: 'Enviar historia' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'Mis historias' })).not.toBeInTheDocument()

    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(callsTo(fetchMock, '/medios')).toHaveLength(1) // the audio went up once
    const [first, second] = callsTo(fetchMock, '/historias').map(([, init]) => JSON.parse(init.body))
    expect(second.client_id).toBe(first.client_id) // the server recognizes the retry
  })

  it('shows "Enviando…" and blocks a second tap while the story goes up', async () => {
    const user = userEvent.setup()
    let release
    const gate = new Promise((resolve) => (release = resolve))
    const { fetchMock } = open({ '/historias': () => gate.then(() => created) })
    await writeStory(user)
    await fillWhereAndWhen(user)
    await user.click(nextButton())

    await user.click(nextButton())
    const sending = await screen.findByRole('button', { name: 'Enviando…' })
    expect(sending).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled()

    release()
    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(callsTo(fetchMock, '/historias')).toHaveLength(1)
  })

  it('without signal the last step explains it and does not send', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await writeStory(user)
    await fillWhereAndWhen(user)
    await user.click(nextButton())

    act(() => toggleSimulatedOffline())

    expect(await screen.findByText(/Para enviarla necesitas señal/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar historia' })).toBeDisabled()
    expect(screen.getByText('Sin señal: necesitas conexión para enviarla.')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias')).toHaveLength(0)

    act(() => toggleSimulatedOffline())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar historia' })).toBeEnabled())
  })

  it('asks to sign in again when the session expired, without losing the story', async () => {
    const user = userEvent.setup()
    open({ '/historias': () => reply({ detail: 'Tu sesión venció.' }, 401) })
    await writeStory(user)
    await fillWhereAndWhen(user)
    await user.click(nextButton())
    await user.click(nextButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(SEND_MESSAGES.expired)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('REVISA ANTES DE ENVIAR')).toBeInTheDocument()
  })

  it('a visitor who is not signed in never sees the form', () => {
    renderApp({ route: '/contar' })

    expect(screen.queryByRole('heading', { name: 'Contar una historia' })).not.toBeInTheDocument()
  })
})
