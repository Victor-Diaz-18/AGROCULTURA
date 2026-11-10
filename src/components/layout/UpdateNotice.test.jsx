import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { breakStoreForTests } from '../../offline/store.js'
import { SLOW_AFTER_MS, watchForUpdates } from '../../offline/updates.js'
import { pwa } from '../../test/pwaRegister.js'
import { renderApp } from '../../test/renderApp.jsx'

beforeEach(() => {
  pwa.updated = 0
  watchForUpdates({ enabled: true })
})
afterEach(() => vi.useRealTimers())

const newVersionArrives = () => act(() => pwa.options.onNeedRefresh())

describe('"Hay una versión nueva"', () => {
  it('is not shown while there is no new version', async () => {
    renderApp()
    await screen.findByRole('heading', { name: 'Mapa de historias' })

    expect(screen.queryByText('Hay una versión nueva.')).not.toBeInTheDocument()
  })

  it('appears when a new version is waiting, and says what updating does', async () => {
    renderApp()
    await screen.findByRole('heading', { name: 'Mapa de historias' })

    newVersionArrives()

    expect(await screen.findByText('Hay una versión nueva.')).toBeInTheDocument()
    expect(screen.getByText(/la página se vuelve a cargar/)).toHaveTextContent('Lo que llevas de tu historia se guarda en el dispositivo.')
  })

  it('does not promise to keep the story when the phone cannot keep anything', async () => {
    breakStoreForTests()
    renderApp()
    newVersionArrives()

    expect(await screen.findByText(/en este teléfono no se puede guardar/)).toBeInTheDocument()
    expect(screen.queryByText(/se guarda en el dispositivo/)).not.toBeInTheDocument()
  })

  it('"Actualizar" switches to the new version', async () => {
    const user = userEvent.setup()
    renderApp()
    newVersionArrives()

    await user.click(await screen.findByRole('button', { name: 'Actualizar' }))

    expect(pwa.updated).toBe(1)
    // It says so while the page is about to reload, and cannot be pressed twice.
    expect(await screen.findByRole('button', { name: 'Actualizando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Después' })).toBeDisabled()
  })

  it('says what is holding the update when it takes long, and can still be put away', async () => {
    renderApp()
    newVersionArrives()
    act(() => pwa.options.onRegisteredSW('/sw.js', { waiting: {}, update: async () => {} })) // the new version does not take over
    const button = await screen.findByRole('button', { name: 'Actualizar' })

    vi.useFakeTimers()
    fireEvent.click(button)
    await act(() => vi.advanceTimersByTimeAsync(SLOW_AFTER_MS))

    expect(screen.getByText(/abierta en otra pestaña o ventana/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actualizando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Después' })).toBeEnabled()
  })

  it('"Después" hides it and leaves the app as it is', async () => {
    const user = userEvent.setup()
    renderApp()
    newVersionArrives()

    await user.click(await screen.findByRole('button', { name: 'Después' }))

    expect(screen.queryByText('Hay una versión nueva.')).not.toBeInTheDocument()
    expect(pwa.updated).toBe(0)
  })

  it('is shown inside the administration panel too', async () => {
    renderApp({ route: '/admin' })
    newVersionArrives()

    expect(await screen.findByText('Hay una versión nueva.')).toBeInTheDocument()
  })
})
