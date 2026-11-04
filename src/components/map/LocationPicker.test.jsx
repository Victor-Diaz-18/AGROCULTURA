import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CONFIG } from '../../test/fixtures.js'
import { mockMapSize } from '../../test/layout.js'
import { sectorAt } from '../../utils/geo.js'
import LocationPicker, { GPS_MESSAGES } from './LocationPicker.jsx'

const sectors = CONFIG.sectores

function setGeolocation(getCurrentPosition) {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}

afterEach(() => {
  delete navigator.geolocation
})

describe('LocationPicker (F3, F1)', () => {
  it('shows one button per sector on the map, except for a sector whose point is not confirmed', () => {
    render(<LocationPicker sectors={sectors} value={null} onChange={vi.fn()} />)

    for (const name of ['Minca', 'La Tagua', 'San Lorenzo']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Tijereras' })).not.toBeInTheDocument() // it would put the story on a made-up place
    expect(screen.getByRole('application', { name: 'Mapa para elegir dónde ocurrió' })).toBeInTheDocument()
  })

  it('choosing a sector puts the story at the center of that sector', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<LocationPicker sectors={sectors} value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'La Tagua' }))

    expect(onChange).toHaveBeenCalledWith({ lat: 11.082986, lon: -74.044951, origen: 'sector', sectorId: 'la-tagua' })
  })

  it('marks the chosen sector without a pin (the marked button is enough)', () => {
    const value = { lat: 11.14, lon: -74.118, origen: 'sector', sectorId: 'minca' }
    const { container } = render(<LocationPicker sectors={sectors} value={value} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Minca' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'San Lorenzo' })).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('.ag-location-pin')).toBeNull()
  })

  it.each(['mapa', 'gps'])('shows the red pin where the person tapped or was found (%s)', (origen) => {
    const value = { lat: 11.131, lon: -74.1, origen, sectorId: 'la-tagua' }
    const { container } = render(<LocationPicker sectors={sectors} value={value} onChange={vi.fn()} />)

    expect(container.querySelector('.ag-location-pin')).not.toBeNull()
  })

  it('shows no pin until a place is chosen', () => {
    const { container } = render(<LocationPicker sectors={sectors} value={null} onChange={vi.fn()} />)

    expect(container.querySelector('.ag-location-pin')).toBeNull()
  })

  it('"Usar mi ubicación" takes the phone position and says which sector it is in', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    setGeolocation((ok) => ok({ coords: { latitude: 11.0835, longitude: -74.045 } }))
    render(<LocationPicker sectors={sectors} value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(onChange).toHaveBeenCalledWith({ lat: 11.0835, lon: -74.045, origen: 'gps', sectorId: 'la-tagua' })
    expect(screen.getByText(GPS_MESSAGES.found)).toBeInTheDocument()
  })

  it('accepts a position anywhere in the zone, with no sector when it is far from all of them', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    setGeolocation((ok) => ok({ coords: { latitude: 11.2, longitude: -73.95 } }))
    render(<LocationPicker sectors={sectors} value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(onChange).toHaveBeenCalledWith({ lat: 11.2, lon: -73.95, origen: 'gps', sectorId: null })
  })

  it('does not accept a position outside the zone, and says why', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    setGeolocation((ok) => ok({ coords: { latitude: 4.7, longitude: -74.07 } })) // Bogotá
    render(<LocationPicker sectors={sectors} value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(screen.getByText(GPS_MESSAGES.outside)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('tapping the map picks that very point, wherever it is in the zone', () => {
    const restore = mockMapSize()
    const onChange = vi.fn()
    render(<LocationPicker sectors={sectors} value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('application', { name: 'Mapa para elegir dónde ocurrió' }), { clientX: 400, clientY: 115 })

    expect(onChange).toHaveBeenCalledTimes(1)
    const chosen = onChange.mock.calls[0][0]
    expect(chosen.origen).toBe('mapa')
    expect(Number.isFinite(chosen.lat) && Number.isFinite(chosen.lon)).toBe(true)
    expect(chosen.sectorId).toBe(sectorAt(chosen, sectors)?.id ?? null) // the sector it falls in, or none
    restore()
  })

  it('asks the browser for a precise position', async () => {
    const user = userEvent.setup()
    const getCurrentPosition = vi.fn((ok) => ok({ coords: { latitude: 11.14, longitude: -74.118 } }))
    setGeolocation(getCurrentPosition)
    render(<LocationPicker sectors={sectors} value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true })
  })

  it('explains it when the location is not allowed, without choosing anything', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    setGeolocation((_ok, fail) => fail({ code: 1 }))
    render(<LocationPicker sectors={sectors} value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(screen.getByText(GPS_MESSAGES.denied)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('explains it when the position cannot be found', async () => {
    const user = userEvent.setup()
    setGeolocation((_ok, fail) => fail({ code: 3 }))
    render(<LocationPicker sectors={sectors} value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(screen.getByText(GPS_MESSAGES.unavailable)).toBeInTheDocument()
  })

  it('says so when the device has no location service', async () => {
    const user = userEvent.setup()
    render(<LocationPicker sectors={sectors} value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(screen.getByText(GPS_MESSAGES.unsupported)).toBeInTheDocument()
  })

  it('works without the sectors loaded yet: the story is still placed, and the server finds its sector', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    setGeolocation((ok) => ok({ coords: { latitude: 11.14, longitude: -74.118 } }))
    render(<LocationPicker sectors={[]} value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación/ }))

    expect(onChange).toHaveBeenCalledWith({ lat: 11.14, lon: -74.118, origen: 'gps', sectorId: null })
  })

})
