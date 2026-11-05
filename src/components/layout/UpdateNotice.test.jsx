import { beforeEach, describe, expect, it } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { breakStoreForTests } from '../../offline/store.js'
import { watchForUpdates } from '../../offline/updates.js'
import { pwa } from '../../test/pwaRegister.js'
import { renderApp } from '../../test/renderApp.jsx'

beforeEach(() => {
  pwa.updated = 0
  watchForUpdates({ enabled: true })
})

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
