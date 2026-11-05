import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toggleSimulatedOffline } from '../../offline/connectivity.js'
import { breakStoreForTests, loadWorkingDraft } from '../../offline/store.js'
import { NARRATOR } from '../../test/auth.js'
import { installFakeRecording } from '../../test/fakeMedia.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'
import { put } from '@vercel/blob/client'
import { setRetryDelayForTests } from '../../context/OutboxContext.jsx'
import { SEND_MESSAGES } from './TellPage.jsx'

vi.mock('../../offline/media.js', () => ({
  compressImage: vi.fn(async () => new Blob(['reduced-photo'], { type: 'image/jpeg' })),
}))
vi.mock('@vercel/blob/client', () => ({ put: vi.fn() })) // the video goes straight to Blob: no network here

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

/** The authorization to publish: the box of step 3. A story cannot be sent without it. */
const authorizationBox = () => screen.getByRole('checkbox', { name: /^Autorizo que mi historia se publique/ })
async function authorize(user) {
  if (!authorizationBox().checked) await user.click(authorizationBox())
}

/** Taps the main button. On the last step the person first ticks the authorization, as they have to. */
async function proceed(user) {
  if (screen.queryByRole('checkbox', { name: /^Autorizo que mi historia se publique/ })) await authorize(user)
  await user.click(nextButton())
}

function open(api = {}) {
  return renderApp({
    route: '/contar',
    user: NARRATOR,
    api: { '/historias': () => created, '/historias/mias': [], '/medios': uploadAnswer, ...api },
  })
}

async function writeStory(user, text = 'Antes de que hubiera carretera, el café bajaba en mula.') {
  await user.type(screen.getByLabelText('O escríbela'), text)
  await proceed(user)
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
    expect(screen.getByText('Falta el título, el lugar o la época.')).toBeInTheDocument()

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
    await proceed(user)
    expect(screen.getByText(/Otro lugar de la zona · Antes de 1960/)).toBeInTheDocument()
    await proceed(user)

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
    await proceed(user)
    await proceed(user)
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

    await proceed(user)
    await proceed(user)

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

    expect(screen.getByText(/queda fuera del área del mapa/)).toBeInTheDocument()
    expect(screen.getByText(/elige «Sin ubicación»/)).toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
  })
})

describe('Contar una historia: sending (F3, F5, F4)', () => {
  it('sends a written story for review and goes to "Mis historias"', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await writeStory(user)
    await fillWhereAndWhen(user)
    await proceed(user)

    expect(screen.getByText('REVISA ANTES DE ENVIAR')).toBeInTheDocument()
    expect(screen.getByText('Hay señal')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias')).toHaveLength(0) // nothing leaves the phone before the last button
    await proceed(user)

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
    await proceed(user)
    await proceed(user)

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
    await proceed(user)
    await fillWhereAndWhen(user)
    await proceed(user)
    expect(screen.getByText('Historia contada en audio. La transcripción se agrega después.')).toBeInTheDocument()
    await proceed(user)

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
    await proceed(user)

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
    await proceed(user)
    await fillWhereAndWhen(user)
    await proceed(user)
    expect(screen.getAllByText('1 foto')).toHaveLength(2) // the format chip and the side summary
    await proceed(user)

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
    await proceed(user)
    await fillWhereAndWhen(user)
    await proceed(user)
    await proceed(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo falló en el servidor.')
    expect(screen.getByRole('button', { name: 'Enviar historia' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'Mis historias' })).not.toBeInTheDocument()

    await proceed(user)

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
    await proceed(user)

    await proceed(user)
    const sending = await screen.findByRole('button', { name: 'Enviando…' })
    expect(sending).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled()

    release()
    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(callsTo(fetchMock, '/historias')).toHaveLength(1)
  })

  it('without signal the last step offers to keep the story on the device instead of sending it', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await writeStory(user)
    await fillWhereAndWhen(user)
    await proceed(user)

    act(() => toggleSimulatedOffline())

    expect(await screen.findByText('Se guarda en el dispositivo y se envía sola cuando vuelva la señal.')).toBeInTheDocument()
    await authorize(user)
    expect(screen.getByRole('button', { name: 'Guardar en el dispositivo' })).toBeEnabled()
    expect(screen.getByText('Sin señal: quedará como borrador.')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias')).toHaveLength(0)

    act(() => toggleSimulatedOffline())
    expect(await screen.findByRole('button', { name: 'Enviar historia' })).toBeEnabled()
  })

  it('asks to sign in again when the session expired, without losing the story', async () => {
    const user = userEvent.setup()
    open({ '/historias': () => reply({ detail: 'Tu sesión venció.' }, 401) })
    await writeStory(user)
    await fillWhereAndWhen(user)
    await proceed(user)
    await proceed(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(SEND_MESSAGES.expired)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('REVISA ANTES DE ENVIAR')).toBeInTheDocument()
  })

  it('a visitor who is not signed in never sees the form', () => {
    renderApp({ route: '/contar' })

    expect(screen.queryByRole('heading', { name: 'Contar una historia' })).not.toBeInTheDocument()
  })
})

/** The narrator's list as the server keeps it: empty until a story is created. */
function serverWithStories() {
  const sent = []
  return {
    sent,
    api: {
      '/historias': (init) => {
        const body = JSON.parse(init.body)
        sent.push({
          codigo: `HIS-2026-${String(20 + sent.length)}`,
          titulo: body.titulo,
          sector_id: 'minca',
          epoca: body.epoca,
          formatos: body.medios.length ? ['Audio'] : ['Texto'],
          estado: 'revision',
          motivo_rechazo: null,
          enviada_en: '2026-11-04T10:00:00Z',
          client_id: body.client_id,
        })
        return { ...sent.at(-1) }
      },
      '/historias/mias': () => [...sent],
    },
  }
}

describe('Contar una historia: sin señal (F10)', () => {
  const finishAndSave = async (user) => {
    await writeStory(user)
    await fillWhereAndWhen(user)
    await proceed(user)
  }

  it('keeps the finished story on the device, tells it, and shows it as a draft in "Mis historias"', async () => {
    const user = userEvent.setup()
    const server = serverWithStories()
    const { fetchMock } = open(server.api)
    await finishAndSave(user)
    act(() => toggleSimulatedOffline())

    await authorize(user)
    await user.click(await screen.findByRole('button', { name: 'Guardar en el dispositivo' }))

    expect(await screen.findByRole('heading', { name: 'Mis historias' })).toBeInTheDocument()
    expect(screen.getByText(SEND_MESSAGES.queued)).toBeInTheDocument()
    expect(callsTo(fetchMock, '/historias')).toHaveLength(0)
    const row = (await screen.findByText('El camino de mulas')).closest('[role="row"]')
    expect(row).toHaveTextContent('Borrador')
    expect(row).toHaveTextContent('Por asignar')
    expect(row).toHaveTextContent('Se envía cuando haya señal')
  })

  it('sends it by itself when the signal returns, with the same id, and says so', async () => {
    const user = userEvent.setup()
    const server = serverWithStories()
    const { fetchMock } = open(server.api)
    await finishAndSave(user)
    act(() => toggleSimulatedOffline())
    await authorize(user)
    await user.click(await screen.findByRole('button', { name: 'Guardar en el dispositivo' }))
    await screen.findByText('Por asignar')

    act(() => toggleSimulatedOffline())

    expect(await screen.findByText('Volvió la señal: se envió 1 borrador a revisión.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Por asignar')).not.toBeInTheDocument())
    const row = (await screen.findByText('HIS-2026-20')).closest('[role="row"]')
    expect(row).toHaveTextContent('En revisión')
    expect(callsTo(fetchMock, '/historias')).toHaveLength(1)
    expect(sentBody(fetchMock).client_id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })

  it('a story with a recording and photos goes out whole when the signal returns', async () => {
    const user = userEvent.setup()
    installFakeRecording()
    const server = serverWithStories()
    const { fetchMock } = open(server.api)
    await user.click(screen.getByRole('button', { name: 'Grabar tu historia' }))
    await user.click(await screen.findByRole('button', { name: 'Terminar de grabar' }))
    await user.upload(screen.getByLabelText('Elegir fotos'), new File(['x'], 'p.jpg', { type: 'image/jpeg' }))
    await screen.findByText(/foto_01\.jpg/)
    await proceed(user)
    await fillWhereAndWhen(user)
    await proceed(user)
    act(() => toggleSimulatedOffline())
    await authorize(user)
    await user.click(await screen.findByRole('button', { name: 'Guardar en el dispositivo' }))
    await screen.findByText('Por asignar')
    expect(callsTo(fetchMock, '/medios')).toHaveLength(0)

    act(() => toggleSimulatedOffline())

    await screen.findByText('Volvió la señal: se envió 1 borrador a revisión.')
    const uploads = callsTo(fetchMock, '/medios').map(([, init]) => init.body.get('tipo'))
    expect(uploads).toEqual(['audio', 'foto'])
    expect(sentBody(fetchMock).medios.map((medio) => medio.tipo)).toEqual(['audio', 'foto'])
  })

  it('if the signal is lost while sending, the story is kept and what already went up is not uploaded again', async () => {
    const user = userEvent.setup()
    installFakeRecording()
    const server = serverWithStories()
    let signal = true
    const { fetchMock } = open({
      ...server.api,
      '/historias': (init, url) => {
        if (!signal) throw new TypeError('Failed to fetch') // what a browser does when the connection drops
        return server.api['/historias'](init, url)
      },
    })
    await user.click(screen.getByRole('button', { name: 'Grabar tu historia' }))
    await user.click(await screen.findByRole('button', { name: 'Terminar de grabar' }))
    await proceed(user)
    await fillWhereAndWhen(user)
    await proceed(user)
    signal = false
    await authorize(user)

    await user.click(screen.getByRole('button', { name: 'Enviar historia' }))

    expect(await screen.findByRole('heading', { name: 'Mis historias' })).toBeInTheDocument()
    expect(screen.getByText(SEND_MESSAGES.queued)).toBeInTheDocument()
    expect(await screen.findByText('Por asignar')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/medios')).toHaveLength(1)

    signal = true
    act(() => toggleSimulatedOffline())
    act(() => toggleSimulatedOffline()) // the connection comes back

    await screen.findByText(/se envió 1 borrador a revisión/)
    expect(callsTo(fetchMock, '/medios')).toHaveLength(1) // the audio was not uploaded a second time
    const ids = callsTo(fetchMock, '/historias').map(([, init]) => JSON.parse(init.body).client_id)
    expect(new Set(ids).size).toBe(1) // one story, however many attempts
  })

  it('says plainly when the phone cannot keep the story beyond this page', async () => {
    const user = userEvent.setup()
    breakStoreForTests()
    open(serverWithStories().api)
    await finishAndSave(user)
    act(() => toggleSimulatedOffline())

    await authorize(user)
    await user.click(await screen.findByRole('button', { name: 'Guardar en el dispositivo' }))

    expect(await screen.findByText(SEND_MESSAGES.queuedLoose)).toBeInTheDocument()
  })
})

describe('Contar una historia: lo que queda a medias se guarda en el dispositivo (F10)', () => {
  it('comes back as it was left when the person returns to the page', async () => {
    const user = userEvent.setup()
    const first = open()
    await user.type(screen.getByLabelText('O escríbela'), 'Mi abuelo sembró el primer cafetal.')
    await proceed(user)
    await user.type(screen.getByLabelText('Ponle un título'), 'El primer cafetal')
    await user.click(screen.getByRole('button', { name: 'Minca' }))
    first.unmount() // closing the page

    open()

    expect(await screen.findByText('Recuperamos la historia que dejaste a medias.')).toBeInTheDocument()
    expect(screen.getByText('Dónde y cuándo').closest('li')).toHaveAttribute('aria-current', 'step') // on the step it was left
    expect(screen.getByLabelText('Ponle un título')).toHaveValue('El primer cafetal')
    expect(screen.getByRole('complementary', { name: 'Resumen de tu historia' })).toHaveTextContent('Lugar: Minca')
    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByLabelText('O escríbela')).toHaveValue('Mi abuelo sembró el primer cafetal.')
  })

  it('also keeps it while the person is still typing, without waiting for them to leave', async () => {
    const user = userEvent.setup()
    open()
    await user.type(screen.getByLabelText('O escríbela'), 'Un recuerdo.')

    await waitFor(async () => expect((await loadWorkingDraft(NARRATOR.id))?.texto).toBe('Un recuerdo.'), { timeout: 3000 })
  })

  it('brings back the recording and the photos too', async () => {
    const user = userEvent.setup()
    installFakeRecording()
    const first = open()
    await user.click(screen.getByRole('button', { name: 'Grabar tu historia' }))
    await user.click(await screen.findByRole('button', { name: 'Terminar de grabar' }))
    await user.upload(screen.getByLabelText('Elegir fotos'), new File(['x'], 'p.jpg', { type: 'image/jpeg' }))
    await screen.findByText(/foto_01\.jpg/)
    first.unmount()

    open()

    expect(await screen.findByText(/Audio grabado/)).toBeInTheDocument()
    expect(screen.getByText('Se guarda en este dispositivo hasta que la envíes.')).toBeInTheDocument()
    expect(screen.getByText(/foto_01\.jpg/)).toBeInTheDocument()
  })

  it('"Empezar de nuevo" leaves an empty page and nothing is kept', async () => {
    const user = userEvent.setup()
    const first = open()
    await user.type(screen.getByLabelText('O escríbela'), 'Algo que ya no quiero.')
    first.unmount()
    open()
    await user.click(await screen.findByRole('button', { name: 'Empezar de nuevo' }))

    expect(screen.getByLabelText('O escríbela')).toHaveValue('')
    expect(screen.queryByText('Recuperamos la historia que dejaste a medias.')).not.toBeInTheDocument()
    expect(await loadWorkingDraft(NARRATOR.id)).toBeNull()
  })

  it('once the story is sent nothing of it remains to be recovered', async () => {
    const user = userEvent.setup()
    const server = serverWithStories()
    open(server.api)
    await writeStory(user)
    await fillWhereAndWhen(user)
    await proceed(user)
    await proceed(user)
    await screen.findByRole('heading', { name: 'Mis historias' })

    expect(await loadWorkingDraft(NARRATOR.id)).toBeNull()
  })

  it('belongs to the person who told it: another narrator starts with an empty page', async () => {
    const user = userEvent.setup()
    const first = open()
    await user.type(screen.getByLabelText('O escríbela'), 'Esto es de Ana.')
    first.unmount()

    renderApp({ route: '/contar', user: { ...NARRATOR, id: 'u2', nombre: 'Luis' }, api: { '/historias/mias': [] } })

    await screen.findByRole('heading', { name: 'Contar una historia' })
    expect(screen.getByLabelText('O escríbela')).toHaveValue('')
    expect(screen.queryByText('Recuperamos la historia que dejaste a medias.')).not.toBeInTheDocument()
  })

  it('on a phone that cannot keep it, says the story stays on the page only', async () => {
    breakStoreForTests()
    open()

    expect(await screen.findByText(/Tu teléfono no deja guardar en el dispositivo/)).toBeInTheDocument()
  })
})


describe('Contar una historia: el video (F13)', () => {
  const VIDEO_URL = 'https://store1.public.blob.vercel-storage.com/historias/u1/video-ab12.mp4'
  const movie = (size = 8000) => new File([new Uint8Array(size)], 'IMG_0042.MOV', { type: 'video/quicktime' })
  const videoApi = (server, extra = {}) => ({
    ...server.api,
    '/blob-token': { type: 'blob.generate-client-token', clientToken: 'client-token-1' },
    '/historias/HIS-2026-20/video': { codigo: 'HIS-2026-20', titulo: 'x', estado: 'revision', enviada_en: '' },
    ...extra,
  })
  const addVideo = async (user, file = movie()) => {
    await user.upload(screen.getByLabelText('Elegir un video'), file)
    await screen.findByText(/video_01\.mov/)
  }
  const reachReview = async (user) => {
    await user.type(screen.getByLabelText('O escríbela'), 'Antes de que hubiera carretera, el café bajaba en mula.')
    await addVideo(user)
    await proceed(user)
    await fillWhereAndWhen(user)
    await proceed(user)
  }
  const postsTo = (fetchMock, path) => callsTo(fetchMock, path).filter(([, init]) => init?.method === 'POST')

  beforeEach(() => {
    put.mockReset().mockResolvedValue({ url: VIDEO_URL })
  })
  afterEach(() => setRetryDelayForTests())

  it('is part of "Fotos y video": a button, a chip with its name and size, and the video as a format', async () => {
    const user = userEvent.setup()
    open()

    expect(screen.getByText('Fotos y video')).toBeInTheDocument()
    await user.type(screen.getByLabelText('O escríbela'), 'Un recuerdo.')
    expect(screen.getByText('Puedes agregar fotos o un video si los tienes.')).toBeInTheDocument()
    await addVideo(user)

    expect(screen.getByText('video_01.mov · 8 KB')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar video/ })).toBeDisabled()
    expect(screen.getByRole('complementary', { name: 'Resumen de tu historia' })).toHaveTextContent('Formatos: Video')
  })

  it('a video alone is not a story: there still has to be a voice or a text', async () => {
    const user = userEvent.setup()
    open()

    await addVideo(user)

    expect(nextButton()).toBeDisabled()
  })

  it('can be taken out again', async () => {
    const user = userEvent.setup()
    open()
    await user.type(screen.getByLabelText('O escríbela'), 'Un recuerdo.')
    await addVideo(user)

    await user.click(screen.getByRole('button', { name: 'Quitar video_01.mov' }))

    expect(screen.queryByText(/video_01\.mov/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar video/ })).toBeEnabled()
  })

  it('the review lists the video among the formats', async () => {
    const user = userEvent.setup()
    open()
    await reachReview(user)

    expect(screen.getByText('REVISA ANTES DE ENVIAR')).toBeInTheDocument()
    expect(screen.getByText('Video', { selector: '.ag-format' })).toBeInTheDocument()
  })

  it('sends the story first, without waiting for the video, which then goes up and is added to it', async () => {
    const user = userEvent.setup()
    const server = serverWithStories()
    const { fetchMock } = open(videoApi(server))
    await reachReview(user)

    await proceed(user)

    expect(await screen.findByRole('heading', { name: 'Mis historias' })).toBeInTheDocument()
    const body = sentBody(fetchMock)
    expect(body.medios).toEqual([]) // the story went without it
    expect(await screen.findByText('Se subió el video de «El camino de mulas».')).toBeInTheDocument()
    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0][0]).toMatch(/^historias\/u1\/video-.*\.mov$/)
    const attach = postsTo(fetchMock, '/historias/HIS-2026-20/video')
    expect(attach).toHaveLength(1)
    expect(JSON.parse(attach[0][1].body)).toEqual({ url: VIDEO_URL, mime: 'video/quicktime', bytes: 8000 })
    expect(postsTo(fetchMock, '/historias')).toHaveLength(1) // one story
  })

  it('the story is in even when the video cannot go up; the video waits on the phone and is tried again', async () => {
    const user = userEvent.setup()
    setRetryDelayForTests(40)
    const server = serverWithStories()
    put.mockRejectedValueOnce(new Error('connection reset')).mockResolvedValue({ url: VIDEO_URL })
    const { fetchMock } = open(videoApi(server))
    await reachReview(user)

    await proceed(user)

    expect(await screen.findByRole('heading', { name: 'Mis historias' })).toBeInTheDocument()
    expect(await screen.findByText('Se subió el video de «El camino de mulas».', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(put).toHaveBeenCalledTimes(2) // the first one failed, the second one went
    expect(postsTo(fetchMock, '/historias')).toHaveLength(1) // the story was never sent twice
    expect(postsTo(fetchMock, '/historias/HIS-2026-20/video')).toHaveLength(1)
  })

  it('without signal the story and its video are kept on the device and both go out when the signal returns', async () => {
    const user = userEvent.setup()
    const server = serverWithStories()
    const { fetchMock } = open(videoApi(server))
    await reachReview(user)
    act(() => toggleSimulatedOffline())
    await authorize(user)
    await user.click(await screen.findByRole('button', { name: 'Guardar en el dispositivo' }))
    await screen.findByText('Por asignar')
    expect(put).not.toHaveBeenCalled()

    act(() => toggleSimulatedOffline())

    expect(await screen.findByText(/se envió 1 borrador a revisión/)).toBeInTheDocument()
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(postsTo(fetchMock, '/historias/HIS-2026-20/video')).toHaveLength(1))
    expect(postsTo(fetchMock, '/historias')).toHaveLength(1)
  })

  it('comes back with the story that was left half told', async () => {
    const user = userEvent.setup()
    const first = open()
    await user.type(screen.getByLabelText('O escríbela'), 'Un recuerdo.')
    await addVideo(user)
    first.unmount()

    open()

    expect(await screen.findByText('Recuperamos la historia que dejaste a medias.')).toBeInTheDocument()
    expect(screen.getByText('video_01.mov · 8 KB')).toBeInTheDocument()
  })

  it('"Empezar de nuevo" lets go of the video too', async () => {
    const user = userEvent.setup()
    const first = open()
    await user.type(screen.getByLabelText('O escríbela'), 'Un recuerdo.')
    await addVideo(user)
    first.unmount()
    open()

    await user.click(await screen.findByRole('button', { name: 'Empezar de nuevo' }))

    expect(screen.queryByText(/video_01\.mov/)).not.toBeInTheDocument()
    expect((await loadWorkingDraft(NARRATOR.id)) ?? null).toBeNull()
  })

  it('once the story is sent nothing of the draft remains, not even the video', async () => {
    const user = userEvent.setup()
    const server = serverWithStories()
    open(videoApi(server))
    await reachReview(user)

    await proceed(user)
    await screen.findByRole('heading', { name: 'Mis historias' })

    expect(await loadWorkingDraft(NARRATOR.id)).toBeNull()
  })
})

// ---- privacy and consent: where, whose name, and the authorization --------------------------------------------------

const place = (name) => screen.getByRole('radio', { name })
const authorizationText = () => screen.getByRole('checkbox', { name: /^Autorizo que mi historia se publique/ })

async function reachStep3(user, options = {}) {
  await writeStory(user)
  await fillWhereAndWhen(user, options)
  await user.click(nextButton()) // not `proceed`: nothing is ticked on the way
}

describe('Contar una historia: la autorización para publicar', () => {
  it('cannot be sent without it: the button stays disabled and says why', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await reachStep3(user)

    expect(authorizationText()).not.toBeChecked()
    expect(nextButton()).toBeDisabled()
    expect(screen.getByText('Marca la autorización para poder enviarla.')).toBeInTheDocument()
    await user.click(nextButton())
    expect(callsTo(fetchMock, '/historias')).toHaveLength(0) // nothing left the phone

    await user.click(authorizationText())

    expect(nextButton()).toBeEnabled()
    expect(screen.queryByText('Marca la autorización para poder enviarla.')).not.toBeInTheDocument()
  })

  it('cannot be kept on the device without it either (a story kept would be sent later without it)', async () => {
    const user = userEvent.setup()
    open()
    await reachStep3(user)
    act(() => toggleSimulatedOffline())

    expect(await screen.findByRole('button', { name: 'Guardar en el dispositivo' })).toBeDisabled()

    await user.click(authorizationText())
    expect(screen.getByRole('button', { name: 'Guardar en el dispositivo' })).toBeEnabled()
  })

  it('goes with the story: its version and the moment it was ticked', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await reachStep3(user)

    await user.click(authorizationText())
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    const { consentimiento } = sentBody(fetchMock)
    expect(consentimiento).toEqual({ aceptado: true, version: expect.stringMatching(/^\d{4}-\d{2}-\d+$/), aceptado_en: expect.stringMatching(/Z$/) })
    expect(Math.abs(Date.now() - new Date(consentimiento.aceptado_en).getTime())).toBeLessThan(60_000)
  })

  it('says what was chosen: with the name and an approximate place', async () => {
    const user = userEvent.setup()
    open()
    await reachStep3(user)

    expect(authorizationText()).toHaveAccessibleName('Autorizo que mi historia se publique con mi nombre y con un lugar aproximado en el mapa (a unos 500 metros).')
    expect(screen.getByText('El equipo de AGROCULTURA sí ve tu nombre y el lugar exacto, para poder revisarla.')).toBeInTheDocument()
  })

  it('changes with "Publicar sin mi nombre", and has to be ticked again', async () => {
    const user = userEvent.setup()
    open()
    await reachStep3(user)
    await user.click(authorizationText())
    expect(nextButton()).toBeEnabled()

    await user.click(screen.getByRole('checkbox', { name: 'Publicar sin mi nombre' }))

    expect(authorizationText()).toHaveAccessibleName(/sin mi nombre \(saldrá como «Narrador anónimo»\) y con un lugar aproximado/)
    expect(authorizationText()).not.toBeChecked() // it was given for another text
    expect(nextButton()).toBeDisabled()

    await user.click(authorizationText())
    expect(nextButton()).toBeEnabled()
  })

  it('changes with the place, and a choice made on step 2 asks again on step 3', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)
    await fillWhereAndWhen(user)
    await user.click(nextButton())
    await user.click(authorizationText())
    await user.click(screen.getByRole('button', { name: 'Atrás' }))

    await user.click(place('Sin ubicación'))
    await user.click(nextButton())

    expect(authorizationText()).toHaveAccessibleName('Autorizo que mi historia se publique con mi nombre y sin ubicación en el mapa.')
    expect(authorizationText()).not.toBeChecked()
    expect(screen.getByText('El equipo de AGROCULTURA sí ve tu nombre y el lugar de referencia que escribas, para poder revisarla.')).toBeInTheDocument()
  })

  it('has its four texts, one for each way of publishing', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)
    await fillWhereAndWhen(user)
    await user.click(place('Sin ubicación'))
    await user.click(nextButton())

    expect(authorizationText()).toHaveAccessibleName('Autorizo que mi historia se publique con mi nombre y sin ubicación en el mapa.')
    await user.click(screen.getByRole('checkbox', { name: 'Publicar sin mi nombre' }))
    expect(authorizationText()).toHaveAccessibleName('Autorizo que mi historia se publique sin mi nombre (saldrá como «Narrador anónimo») y sin ubicación en el mapa.')
  })

  it('can be heard before it is given: the instructions of the last step read it', async () => {
    const spoken = []
    vi.stubGlobal('speechSynthesis', { speak: (u) => spoken.push(u.text), cancel: () => {}, getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {} })
    vi.stubGlobal('SpeechSynthesisUtterance', function (text) { this.text = text })
    const user = userEvent.setup()
    open()
    await reachStep3(user)

    await user.click(screen.getByRole('button', { name: 'Escuchar instrucciones' }))

    expect(spoken.join(' ')).toContain('Autorizo que mi historia se publique con mi nombre y con un lugar aproximado en el mapa')
    vi.unstubAllGlobals()
  })

  it('is kept with the draft the person leaves half told, and a story kept on the device sends it', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await reachStep3(user)
    await user.click(authorizationText())
    act(() => toggleSimulatedOffline())
    await user.click(await screen.findByRole('button', { name: 'Guardar en el dispositivo' }))
    await screen.findByRole('heading', { name: 'Mis historias' })

    act(() => toggleSimulatedOffline())

    await screen.findByText(/se envió 1 borrador a revisión/)
    expect(sentBody(fetchMock).consentimiento).toMatchObject({ aceptado: true })
  })
})

describe('Contar una historia: «Publicar sin mi nombre»', () => {
  it('sends the choice, and the summary says how the name will read', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await reachStep3(user)

    expect(screen.getByText(/Narra Ana Beltrán/)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Publicar sin mi nombre' }))
    expect(screen.getByText(/Narra Narrador anónimo/)).toBeInTheDocument()
    expect(screen.getByText(/tampoco escribas tu nombre en el título ni en la historia/)).toBeInTheDocument()
    await user.click(authorizationText())
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(sentBody(fetchMock).anonima).toBe(true)
  })

  it('sends false when the name stays', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await reachStep3(user)
    await user.click(authorizationText())
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(sentBody(fetchMock).anonima).toBe(false)
  })
})

describe('Contar una historia: dónde ocurrió (lugar aproximado o sin ubicación)', () => {
  it('offers only two options, and starts with the approximate place', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)

    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(place('Lugar aproximado')).toBeChecked()
    expect(place('Sin ubicación')).not.toBeChecked()
    expect(screen.getByRole('application', { name: 'Mapa para elegir dónde ocurrió' })).toBeInTheDocument()
  })

  it('with «Sin ubicación» there is no map, and nothing about where is needed to go on', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)
    await user.type(screen.getByLabelText('Ponle un título'), 'Lo que contaba mi abuela')
    await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), 'Antes de 1960')
    expect(nextButton()).toBeDisabled() // with a place, a place is needed

    await user.click(place('Sin ubicación'))

    expect(screen.queryByRole('application', { name: 'Mapa para elegir dónde ocurrió' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Usar mi ubicación/ })).not.toBeInTheDocument()
    expect(nextButton()).toBeEnabled()
  })

  it('names the reference as something only the team sees, and the farm as something public', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)

    expect(screen.getByLabelText(/Nombre del lugar/)).toHaveAccessibleDescription('Se verá en la ficha pública de la historia.')
    await user.click(place('Sin ubicación'))

    expect(screen.getByLabelText(/Nombre de referencia/)).toHaveAccessibleDescription('Solo lo ve el equipo, para revisar la historia. El público no lo ve.')
    expect(screen.getByLabelText(/Nombre de la finca o marca/)).toHaveAccessibleDescription(/Se verá en la ficha pública.*Piensa si el nombre de la finca dice dónde queda/)
  })

  it('sends no point at all for a story without a place, only the reference', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await writeStory(user)
    await user.type(screen.getByLabelText('Ponle un título'), 'Lo que contaba mi abuela')
    await user.selectOptions(screen.getByRole('combobox', { name: /Cuándo ocurrió/ }), 'Antes de 1960')
    await user.click(place('Sin ubicación'))
    await user.type(screen.getByLabelText(/Nombre de referencia/), 'Cerca de San Lorenzo')
    await user.click(nextButton())
    await user.click(authorizationText())

    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    const body = sentBody(fetchMock)
    expect(body.ubicacion_modo).toBe('ninguna')
    expect(body).not.toHaveProperty('ubicacion')
    expect(body).not.toHaveProperty('ubicacion_origen')
    expect(body.lugar_nombre).toBe('Cerca de San Lorenzo')
  })

  it('does not send a point chosen before changing to «Sin ubicación»', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await writeStory(user)
    await fillWhereAndWhen(user, { sector: 'Minca' }) // a point was chosen...
    await user.click(place('Sin ubicación')) // ...and then the person thought better of it
    await user.click(nextButton())
    await user.click(authorizationText())

    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(JSON.stringify(sentBody(fetchMock))).not.toContain('11.14')
    expect(sentBody(fetchMock)).not.toHaveProperty('ubicacion')
  })

  it('does not say the reference in the summary of a story without a place', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)
    await fillWhereAndWhen(user, { sector: null })
    await user.click(place('Sin ubicación'))
    await user.type(screen.getByLabelText(/Nombre de referencia/), 'Finca Los Mangos')

    const summary = screen.getByRole('complementary', { name: 'Resumen de tu historia' })
    expect(summary).toHaveTextContent('Lugar: Sin ubicación en el mapa')
    expect(summary).not.toHaveTextContent('Los Mangos')
    await user.click(nextButton())
    expect(screen.queryByText(/Los Mangos/)).not.toBeInTheDocument()
  })

  it('comes back to the approximate place with the point that was chosen', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)
    await fillWhereAndWhen(user, { sector: 'La Tagua' })

    await user.click(place('Sin ubicación'))
    await user.click(place('Lugar aproximado'))

    expect(screen.getByRole('application', { name: 'Mapa para elegir dónde ocurrió' })).toBeInTheDocument()
    expect(nextButton()).toBeEnabled()
    expect(screen.getByRole('complementary', { name: 'Resumen de tu historia' })).toHaveTextContent('Lugar: La Tagua')
  })

  it('a draft left half told remembers the options, the farm and the authorization', async () => {
    const user = userEvent.setup()
    open()
    await writeStory(user)
    await user.type(screen.getByLabelText('Ponle un título'), 'Una historia a medias')
    await user.click(place('Sin ubicación'))
    await user.type(screen.getByLabelText(/Nombre de la finca o marca/), 'Café La Loma')

    await waitFor(async () => expect((await loadWorkingDraft(NARRATOR.id))?.finca).toBe('Café La Loma'), { timeout: 3000 })
    const kept = await loadWorkingDraft(NARRATOR.id)
    expect(kept.ubicacionModo).toBe('ninguna')
    expect(kept.anonima).toBe(false)
  })
})

describe('Contar una historia: el nombre de la finca o marca', () => {
  it('is optional: nothing is sent when it is left empty', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await reachStep3(user)
    await user.click(authorizationText())
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(sentBody(fetchMock)).not.toHaveProperty('finca_nombre')
  })

  it('goes with the story and shows in the summary', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    await writeStory(user)
    await fillWhereAndWhen(user)
    await user.type(screen.getByLabelText(/Nombre de la finca o marca/), '  Café Don Aurelio ')
    await user.click(nextButton())

    expect(screen.getByText(/Finca o marca: Café Don Aurelio/)).toBeInTheDocument()
    await user.click(authorizationText())
    await user.click(nextButton())

    await screen.findByRole('heading', { name: 'Mis historias' })
    expect(sentBody(fetchMock).finca_nombre).toBe('Café Don Aurelio')
  })
})

