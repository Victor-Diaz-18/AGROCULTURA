import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import { ADMIN, NARRATOR } from '../../test/auth.js'
import { STATS } from '../../test/fixtures.js'
import { renderApp } from '../../test/renderApp.jsx'

describe('Header', () => {
  it('never shows «datos de ejemplo» under the logo, even while the portal holds sample data', async () => {
    renderApp({ user: ADMIN })

    expect(await screen.findByRole('link', { name: /Panel del equipo/ })).toBeInTheDocument()
    expect(screen.queryByText(/datos de ejemplo/i)).not.toBeInTheDocument()
  })

  it.each([
    ['a narrator', NARRATOR],
    ['an administrator', ADMIN],
  ])('has no switch to pretend the signal is gone, not even for %s: a family would take it for a real setting', async (_, who) => {
    renderApp({ user: who })
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('button', { name: /Simular conexión/ })).not.toBeInTheDocument()
    expect(screen.queryByText('En línea')).not.toBeInTheDocument()
  })

  it('says "Sin señal" (in yellow) only while the phone really has no signal', async () => {
    renderApp({ user: NARRATOR })
    const banner = screen.getByRole('banner')
    expect(within(banner).queryByText('Sin señal')).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('offline')))
    expect(within(banner).getByText('Sin señal').closest('.ag-hchip')).toHaveClass('ag-hchip--offline')

    act(() => window.dispatchEvent(new Event('online')))
    expect(within(banner).queryByText('Sin señal')).not.toBeInTheDocument()
  })

  it('tells the person when the signal goes and when it comes back', async () => {
    renderApp({ user: ADMIN })

    act(() => window.dispatchEvent(new Event('offline')))
    expect(await screen.findByText('Sin señal: lo que cuentes se guarda en el dispositivo.')).toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('online')))
    expect(await screen.findByText('Volvió la señal.')).toBeInTheDocument()
  })

  it('does not call the API while there is no signal, and reloads when it comes back', async () => {
    const { fetchMock } = renderApp({ user: ADMIN })
    await screen.findByRole('heading', { level: 1 })
    fetchMock.mockClear()

    act(() => window.dispatchEvent(new Event('offline')))
    expect(fetchMock).not.toHaveBeenCalled()

    act(() => window.dispatchEvent(new Event('online')))
    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  })

  it('shows each administrator their own name and initials, not one name for all of them', async () => {
    const jeison = { id: 'a2', nombre: 'jeison', rol: 'administrador' }
    const { container } = renderApp({ user: jeison })

    expect(await screen.findByText('jeison', { selector: '.ag-vuser__name' })).toBeInTheDocument()
    expect(container.querySelector('.ag-vuser__avatar')).toHaveTextContent('J')
    expect(screen.queryByText('Administración', { selector: '.ag-vuser__name' })).not.toBeInTheDocument()
  })

  it('shows the same in the administration panel', async () => {
    const jeison = { id: 'a2', nombre: 'Jeison Díaz', rol: 'administrador' }
    const { container } = renderApp({ user: jeison, route: '/admin/configuracion' })

    expect(await screen.findByText('Jeison Díaz', { selector: '.ag-user__name' })).toBeInTheDocument()
    expect(container.querySelector('.ag-user__avatar')).toHaveTextContent('JD')
  })

  it('offers sign-in to visitors', () => {
    renderApp()

    expect(screen.getByRole('button', { name: /Ingresar/ })).toBeInTheDocument()
  })
})
