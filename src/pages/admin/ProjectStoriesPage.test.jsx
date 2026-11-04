import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN } from '../../test/auth.js'
import { adminStory } from '../../test/fixtures.js'
import { mockMapSize } from '../../test/layout.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'
import { put } from '@vercel/blob/client'

vi.mock('../../offline/media.js', () => ({
  compressImage: vi.fn(async () => new Blob(['reduced-photo'], { type: 'image/jpeg' })),
}))
vi.mock('@vercel/blob/client', () => ({ put: vi.fn() })) // the video goes straight to Blob

const PROJECT = adminStory({
  codigo: 'HIS-2026-004',
  titulo: 'El patio donde se secaba el café',
  narrador_nombre: 'Equipo AGROCULTURA',
  sector_id: 'tijereras',
  epoca: '1960 a 1979',
  formatos: ['Foto'],
  estado: 'publicada',
  origen: 'proyecto',
})
const created = adminStory({ codigo: 'HIS-2026-013', titulo: 'Nueva', estado: 'publicada', origen: 'proyecto', sector_id: 'minca' })
const AUDIO_URL = 'https://s.public.blob.vercel-storage.com/historias/a1/audio.mp3'
const PHOTO_URL = 'https://s.public.blob.vercel-storage.com/historias/a1/foto.jpg'

const api = (overrides = {}) => ({
  '/admin/historias': [PROJECT],
  '/admin/historias-proyecto': () => created,
  '/medios': (init) => (init.body.get('tipo') === 'audio' ? { tipo: 'audio', url: AUDIO_URL, mime: 'audio/mpeg', bytes: 9, duracion_s: null } : { tipo: 'foto', url: PHOTO_URL, mime: 'image/jpeg', bytes: 9 }),
  ...overrides,
})
const open = (route = '/admin/historias', overrides) => renderApp({ route, user: ADMIN, api: api(overrides) })
const pickPlaceAndPeriod = async (dialog, user) => {
  await user.click(within(dialog).getByRole('button', { name: 'Minca' }))
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Época' }), '1960 a 1979')
}
const publishButton = () => screen.getByRole('button', { name: /Publicar historia del proyecto|Publicando…/ })
const sentBody = (fetchMock) => JSON.parse(callsTo(fetchMock, '/admin/historias-proyecto')[0][1].body)

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('Historias del proyecto (F12)', () => {
  it('lists the stories the team uploaded', async () => {
    const { fetchMock } = open()

    const row = (await screen.findByText('El patio donde se secaba el café')).closest('[role=row]')
    expect(within(row).getByText('HIS-2026-004')).toBeInTheDocument()
    expect(within(row).getByText('Tijereras')).toBeInTheDocument()
    expect(within(row).getByText('1960 a 1979')).toBeInTheDocument()
    expect(within(row).getByText('Foto')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/historias')[0][0]).toContain('origen=proyecto')
  })

  it('opens the card of a team story', async () => {
    const user = userEvent.setup()
    open()

    await user.click(await screen.findByRole('button', { name: 'Ver ficha' }))

    const dialog = await screen.findByRole('dialog', { name: 'Ficha de la historia' })
    expect(within(dialog).getByRole('heading', { name: 'El patio donde se secaba el café' })).toBeInTheDocument()
    expect(within(dialog).getByText('Proyecto')).toBeInTheDocument()
  })

  it('invites to create the first one', async () => {
    open('/admin/historias', { '/admin/historias': [] })

    expect(await screen.findByText(/Todavía no hay historias del proyecto/)).toBeInTheDocument()
  })

  it('"Nueva historia del proyecto" opens the form', async () => {
    const user = userEvent.setup()
    open()

    await user.click(screen.getByRole('button', { name: 'Nueva historia del proyecto' }))

    expect(await screen.findByRole('dialog', { name: 'Nueva historia del proyecto' })).toBeInTheDocument()
  })

  it('the "Crear historia" link of the menu opens the form straight away', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/admin', user: ADMIN, api: api() })

    await user.click(await screen.findByRole('link', { name: /Crear historia/ }))

    expect(await screen.findByRole('dialog', { name: 'Nueva historia del proyecto' })).toBeInTheDocument()
  })

  it('tells the team that the public map shows only an approximate point, and that only administrators see the exact one', async () => {
    open('/admin/historias?nueva=1')
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText(/En el mapa público se ve un punto aproximado/)).toHaveTextContent('solo lo ven los administradores')
  })

  it('closing the form leaves the list as it was', async () => {
    const user = userEvent.setup()
    open('/admin/historias?nueva=1')
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Historias del proyecto' })).toBeInTheDocument()
  })
})

describe('Nueva historia del proyecto', () => {
  it('will not publish without a title and a story (text or audio)', async () => {
    const user = userEvent.setup()
    open('/admin/historias?nueva=1')
    const dialog = await screen.findByRole('dialog')

    expect(publishButton()).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Título'), 'El patio')
    expect(publishButton()).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Relato'), 'Un relato.')
    expect(publishButton()).toBeDisabled() // still no place and no period
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Época' }), 'Antes de 1960')
    expect(publishButton()).toBeDisabled() // still no place
    await user.click(within(dialog).getByRole('button', { name: 'Minca' }))
    expect(publishButton()).toBeEnabled()
  })

  it('an audio alone is enough instead of the text', async () => {
    const user = userEvent.setup()
    open('/admin/historias?nueva=1')
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Título'), 'El patio')

    await pickPlaceAndPeriod(dialog, user)
    await user.upload(within(dialog).getByLabelText('Elegir un audio'), new File(['x'], 'entrevista.mp3', { type: 'audio/mpeg' }))

    expect(await within(dialog).findByText(/entrevista\.mp3/)).toBeInTheDocument()
    expect(publishButton()).toBeEnabled()
  })

  it('publishes it with the sector, period, who tells it and the tags, then closes and shows the list', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open('/admin/historias?nueva=1')
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('Título'), '  El patio de secado ')
    await user.click(within(dialog).getByRole('button', { name: 'San Lorenzo' }))
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Época' }), '1980 a 1999')
    await user.type(within(dialog).getByLabelText('Nombre del lugar (si quieres)'), '  Patio  de los Pérez ')
    await user.type(within(dialog).getByLabelText('Quién la cuenta'), 'Doña Rosa')
    await user.type(within(dialog).getByLabelText('Relato'), 'Se secaba al sol.')
    await user.click(within(dialog).getByRole('button', { name: '#finca' }))
    await user.click(publishButton())

    expect(await screen.findByText('Historia del proyecto publicada en Minca.')).toBeInTheDocument()
    expect(sentBody(fetchMock)).toMatchObject({
      titulo: 'El patio de secado',
      texto: 'Se secaba al sol.',
      epoca: '1980 a 1999',
      ubicacion: { lat: 11.116315, lon: -74.034676 },
      ubicacion_origen: 'sector',
      etiquetas: ['#finca'],
      narrador_nombre: 'Doña Rosa',
      lugar_nombre: 'Patio  de los Pérez',
      medios: [],
    })
    expect(sentBody(fetchMock).client_id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('can be placed on any point of the zone, not only on a sector', async () => {
    const user = userEvent.setup()
    const restore = mockMapSize()
    const { fetchMock } = open('/admin/historias?nueva=1', { '/admin/historias-proyecto': () => ({ ...created, sector_id: null }) })
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Título'), 'Un camino lejos de los sectores')
    await user.type(within(dialog).getByLabelText('Relato'), 'Texto.')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Época' }), '1960 a 1979')

    fireEvent.click(within(dialog).getByRole('application', { name: 'Mapa para elegir dónde ocurrió' }), { clientX: 400, clientY: 115 })
    await user.click(publishButton())

    expect(await screen.findByText('Historia del proyecto publicada.')).toBeInTheDocument()
    const body = sentBody(fetchMock)
    expect(body.ubicacion_origen).toBe('mapa')
    expect(body.ubicacion).toEqual({ lat: expect.any(Number), lon: expect.any(Number) })
    expect(body).not.toHaveProperty('sector_id')
    restore()
  })

  it('without naming who tells it the team is credited (the server decides the name)', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open('/admin/historias?nueva=1')
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Título'), 'El patio')
    await user.type(within(dialog).getByLabelText('Relato'), 'Texto.')
    await pickPlaceAndPeriod(dialog, user)

    await user.click(publishButton())

    await screen.findByText(/Historia del proyecto publicada/)
    expect(sentBody(fetchMock)).not.toHaveProperty('narrador_nombre')
  })

  it('uploads the photos and the audio first and sends their addresses with the story', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open('/admin/historias?nueva=1')
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Título'), 'Con archivos')
    await pickPlaceAndPeriod(dialog, user)
    await user.upload(within(dialog).getByLabelText('Elegir fotos'), new File(['p'], 'IMG.jpg', { type: 'image/jpeg' }))
    await user.upload(within(dialog).getByLabelText('Elegir un audio'), new File(['a'], 'voz.mp3', { type: 'audio/mpeg' }))
    await within(dialog).findByText(/^foto_01\.jpg/)

    await user.click(publishButton())

    await screen.findByText(/Historia del proyecto publicada/)
    expect(callsTo(fetchMock, '/medios').map(([, init]) => init.body.get('tipo')).sort()).toEqual(['audio', 'foto'])
    const medios = sentBody(fetchMock).medios
    expect(medios.map((medio) => medio.tipo).sort()).toEqual(['audio', 'foto'])
    expect(medios.find((medio) => medio.tipo === 'audio').url).toBe(AUDIO_URL)
  })

  it('refuses an audio that is too big before uploading it', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open('/admin/historias?nueva=1')
    const dialog = await screen.findByRole('dialog')
    const big = new File(['x'], 'larga.mp3', { type: 'audio/mpeg' })
    Object.defineProperty(big, 'size', { value: 4_000_000 })

    await user.upload(within(dialog).getByLabelText('Elegir un audio'), big)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('pesa más de 3,5 MB')
    expect(within(dialog).queryByText(/larga\.mp3/)).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/medios')).toHaveLength(0)
  })

  it('shows what the server did not like and keeps everything that was typed', async () => {
    const user = userEvent.setup()
    open('/admin/historias?nueva=1', { '/admin/historias-proyecto': () => reply({ detail: 'Ese sector no existe. Elige uno de la lista.' }, 422) })
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Título'), 'Mi título')
    await user.type(within(dialog).getByLabelText('Relato'), 'Mi relato')
    await pickPlaceAndPeriod(dialog, user)

    await user.click(publishButton())

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ese sector no existe')
    expect(within(dialog).getByLabelText('Título')).toHaveValue('Mi título')
    expect(publishButton()).toBeEnabled()
  })

  it('a retry does not upload the files again nor create a second story', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const { fetchMock } = open('/admin/historias?nueva=1', { '/admin/historias-proyecto': () => (++attempts === 1 ? reply({ detail: 'Falló' }, 500) : created) })
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Título'), 'Con audio')
    await pickPlaceAndPeriod(dialog, user)
    await user.upload(within(dialog).getByLabelText('Elegir un audio'), new File(['a'], 'voz.mp3', { type: 'audio/mpeg' }))
    await within(dialog).findByText(/voz\.mp3/)

    await user.click(publishButton())
    await within(dialog).findByRole('alert')
    await user.click(publishButton())

    await screen.findByText(/Historia del proyecto publicada/)
    expect(callsTo(fetchMock, '/medios')).toHaveLength(1)
    const [first, second] = callsTo(fetchMock, '/admin/historias-proyecto').map(([, init]) => JSON.parse(init.body))
    expect(second.client_id).toBe(first.client_id)
  })

  it('only administrators get to the page', () => {
    renderApp({ route: '/historias-propias' })

    expect(screen.queryByRole('heading', { name: 'Historias del proyecto' })).not.toBeInTheDocument()
  })
})


describe('Historias del proyecto: el video (F13)', () => {
  const VIDEO_URL = 'https://s.public.blob.vercel-storage.com/historias/a1/video-x.mp4'
  const clip = (size = 6000) => new File([new Uint8Array(size)], 'fiesta.mp4', { type: 'video/mp4' })
  const withToken = { '/blob-token': { type: 'blob.generate-client-token', clientToken: 'client-token-1' } }

  beforeEach(() => put.mockReset().mockResolvedValue({ url: VIDEO_URL }))

  async function fill(user, extra = {}) {
    const { fetchMock } = open('/admin/historias?nueva=1', { ...withToken, ...extra })
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Título'), 'La fiesta')
    await user.type(within(dialog).getByLabelText('Relato'), 'Se celebra al final de la cosecha.')
    await pickPlaceAndPeriod(dialog, user)
    return { fetchMock, dialog }
  }

  it('has "Agregar video" next to the photo and the audio ones', async () => {
    open('/admin/historias?nueva=1')
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('button', { name: /Agregar video/ })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: /Agregar foto/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Agregar audio/ })).toBeInTheDocument()
  })

  it('uploads the video straight to Blob, then publishes the story with its address', async () => {
    const user = userEvent.setup()
    const { fetchMock, dialog } = await fill(user)
    await user.upload(within(dialog).getByLabelText('Elegir un video'), clip())
    await within(dialog).findByText(/^video_01\.mp4/)

    await user.click(publishButton())

    await screen.findByText(/Historia del proyecto publicada/)
    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0][0]).toMatch(/^historias\/a1\/video-.*\.mp4$/) // the administrator's own folder
    const medios = sentBody(fetchMock).medios
    expect(medios).toEqual([{ tipo: 'video', url: VIDEO_URL, mime: 'video/mp4', bytes: 6000 }])
    expect(callsTo(fetchMock, '/medios')).toHaveLength(0) // the video does not go through the API
  })

  it('does not publish without the video when it cannot go up: the team is looking at the screen and tries again', async () => {
    const user = userEvent.setup()
    put.mockRejectedValueOnce(new Error('connection reset'))
    const { fetchMock, dialog } = await fill(user)
    await user.upload(within(dialog).getByLabelText('Elegir un video'), clip())
    await within(dialog).findByText(/^video_01\.mp4/)

    await user.click(publishButton())

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No pudimos subir el video')
    expect(callsTo(fetchMock, '/admin/historias-proyecto')).toHaveLength(0)
    expect(publishButton()).toBeEnabled()

    await user.click(publishButton())

    await screen.findByText(/Historia del proyecto publicada/)
    expect(callsTo(fetchMock, '/admin/historias-proyecto')).toHaveLength(1)
  })

  it('a retry after the story failed does not upload the video again', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const { dialog } = await fill(user, { '/admin/historias-proyecto': () => (++attempts === 1 ? reply({ detail: 'Falló' }, 500) : created) })
    await user.upload(within(dialog).getByLabelText('Elegir un video'), clip())
    await within(dialog).findByText(/^video_01\.mp4/)

    await user.click(publishButton())
    await within(dialog).findByRole('alert')
    await user.click(publishButton())

    await screen.findByText(/Historia del proyecto publicada/)
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('refuses a video over 25 MB before uploading anything', async () => {
    const user = userEvent.setup()
    open('/admin/historias?nueva=1', withToken)
    const dialog = await screen.findByRole('dialog')
    const big = clip()
    Object.defineProperty(big, 'size', { value: 40_000_000 })

    await user.upload(within(dialog).getByLabelText('Elegir un video'), big)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/lo máximo es 25,0 MB/)
    expect(put).not.toHaveBeenCalled()
  })
})
