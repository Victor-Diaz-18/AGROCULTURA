import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { compressImage } from '../../offline/media.js'
import MediaPicker, { PHOTO_MESSAGES } from './MediaPicker.jsx'

vi.mock('../../offline/media.js', () => ({ compressImage: vi.fn() }))

const photo = (n) => ({ id: `p${n}`, name: `foto_0${n}.jpg`, blob: new Blob(['x'.repeat(2000)], { type: 'image/jpeg' }) })
const file = (name) => new File(['raw'], name, { type: 'image/jpeg' })

function setup(photos = []) {
  let counter = photos.length
  const props = { photos, nextName: vi.fn(() => `foto_0${++counter}.jpg`), onAdd: vi.fn(), onRemove: vi.fn() }
  render(<MediaPicker {...props} />)
  return props
}

beforeEach(() => {
  compressImage.mockReset().mockImplementation(async () => new Blob(['reduced'], { type: 'image/jpeg' }))
})

describe('MediaPicker (F4)', () => {
  it('reduces each chosen photo and hands it over with a friendly name', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.upload(screen.getByLabelText('Elegir fotos'), [file('IMG_9921.jpg'), file('IMG_9922.jpg')])

    await waitFor(() => expect(props.onAdd).toHaveBeenCalledTimes(1))
    const added = props.onAdd.mock.calls[0][0]
    expect(added.map((item) => item.name)).toEqual(['foto_01.jpg', 'foto_02.jpg'])
    expect(compressImage).toHaveBeenCalledTimes(2)
  })

  it('lists the photos with their size and lets the person remove one', async () => {
    const user = userEvent.setup()
    const props = setup([photo(1), photo(2)])

    expect(screen.getByText('foto_01.jpg · 2 KB')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar foto_02.jpg' }))

    expect(props.onRemove).toHaveBeenCalledWith('p2')
  })

  it('accepts no more than six photos', async () => {
    const user = userEvent.setup()
    const props = setup([photo(1), photo(2), photo(3), photo(4), photo(5)])

    await user.upload(screen.getByLabelText('Elegir fotos'), [file('a.jpg'), file('b.jpg')])

    await waitFor(() => expect(props.onAdd).toHaveBeenCalledTimes(1))
    expect(props.onAdd.mock.calls[0][0]).toHaveLength(1)
    expect(await screen.findByRole('alert')).toHaveTextContent(PHOTO_MESSAGES.limit)
  })

  it('disables the button once six photos are in', () => {
    setup([photo(1), photo(2), photo(3), photo(4), photo(5), photo(6)])

    expect(screen.getByRole('button', { name: /Agregar foto/ })).toBeDisabled()
  })

  it('says which file could not be read and still keeps the others', async () => {
    const user = userEvent.setup()
    compressImage.mockRejectedValueOnce(new Error('not an image'))
    const props = setup()

    await user.upload(screen.getByLabelText('Elegir fotos'), [file('roto.jpg'), file('bueno.jpg')])

    await waitFor(() => expect(props.onAdd).toHaveBeenCalledTimes(1))
    expect(props.onAdd.mock.calls[0][0]).toHaveLength(1)
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos leer «roto.jpg»')
  })
})

describe('MediaPicker: video (F13)', () => {
  const movie = (name = 'IMG_0042.MOV', type = 'video/quicktime', size = 5000) => {
    const file = new File([new Uint8Array(size)], name, { type })
    return file
  }
  function setupVideo(video = null) {
    const props = { photos: [], nextName: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn(), video, onAddVideo: vi.fn(), onRemoveVideo: vi.fn() }
    render(<MediaPicker {...props} heading="Fotos y video" />)
    return props
  }

  it('has the "Agregar video" button next to the photo one, under "Fotos y video"', () => {
    setupVideo()

    expect(screen.getByText('Fotos y video')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar foto/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar video/ })).toBeEnabled()
  })

  it('is not offered where the page does not take videos', () => {
    setup()

    expect(screen.queryByRole('button', { name: /Agregar video/ })).not.toBeInTheDocument()
  })

  it('keeps the video as it is, with a friendly name and its real type', async () => {
    const user = userEvent.setup()
    const props = setupVideo()

    await user.upload(screen.getByLabelText('Elegir un video'), movie())

    expect(props.onAddVideo).toHaveBeenCalledTimes(1)
    const added = props.onAddVideo.mock.calls[0][0]
    expect(added).toMatchObject({ name: 'video_01.mov', mime: 'video/quicktime' })
    expect(added.blob.size).toBe(5000)
    expect(compressImage).not.toHaveBeenCalled() // a video is not reduced here
  })

  it('shows the video next to the photos, with its size, and lets the person remove it', async () => {
    const user = userEvent.setup()
    const props = setupVideo({ id: 'v1', name: 'video_01.mp4', mime: 'video/mp4', blob: new Blob([new Uint8Array(24_000_000)]) })

    expect(screen.getByRole('list', { name: 'Fotos y video agregados' })).toBeInTheDocument()
    expect(screen.getByText('Video')).toBeInTheDocument()
    expect(screen.getByText('video_01.mp4 · 24,0 MB')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar video_01.mp4' }))

    expect(props.onRemoveVideo).toHaveBeenCalled()
  })

  it('takes only one video: the button is off while there is one', () => {
    setupVideo({ id: 'v1', name: 'video_01.mp4', mime: 'video/mp4', blob: new Blob(['x']) })

    expect(screen.getByRole('button', { name: /Agregar video/ })).toBeDisabled()
  })

  it('refuses what is not a video, and what is over 25 MB, saying why', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const props = setupVideo()

    await user.upload(screen.getByLabelText('Elegir un video'), new File(['x'], 'foto.png', { type: 'image/png' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos leer «foto.png». Usa un video MP4, MOV o WebM.')

    const heavy = movie('largo.mp4', 'video/mp4')
    Object.defineProperty(heavy, 'size', { value: 30_000_000 })
    await user.upload(screen.getByLabelText('Elegir un video'), heavy)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Ese video pesa 30,0 MB y lo máximo es 25,0 MB/)
    expect(props.onAddVideo).not.toHaveBeenCalled()
  })

  it('forgets the complaint once a good video is taken', async () => {
    const user = userEvent.setup({ applyAccept: false })
    setupVideo()
    await user.upload(screen.getByLabelText('Elegir un video'), new File(['x'], 'foto.png', { type: 'image/png' }))
    await screen.findByRole('alert')

    await user.upload(screen.getByLabelText('Elegir un video'), movie('ok.mp4', 'video/mp4'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
