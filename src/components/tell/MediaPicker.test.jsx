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
