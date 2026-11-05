import { describe, expect, it } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NARRATOR } from '../../test/auth.js'
import { STATS } from '../../test/fixtures.js'
import { renderApp } from '../../test/renderApp.jsx'

describe('Header', () => {
  it('shows the public counters from the API', async () => {
    renderApp({ user: NARRATOR, api: { '/estadisticas': { ...STATS, publicadas: 7, en_revision: 4 } } })

    expect(await screen.findByText('7 publicadas')).toBeInTheDocument()
    expect(screen.getByText('4 historias')).toBeInTheDocument()
  })

  it('shows "datos de ejemplo" while the portal holds sample data', async () => {
    renderApp({ user: NARRATOR })

    expect(await screen.findByText(/datos de ejemplo/)).toBeInTheDocument()
  })

  it('"Simular conexión" switches between "En línea" and "Sin señal"', async () => {
    const user = userEvent.setup()
    renderApp({ user: NARRATOR })
    const toggle = screen.getByRole('button', { name: /Simular conexión/ })
    expect(toggle).toHaveTextContent('En línea')

    await user.click(toggle)
    expect(toggle).toHaveTextContent('Sin señal')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle)
    expect(toggle).toHaveTextContent('En línea')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('also shows "Sin señal" (in yellow) when the phone really loses the connection, without the demo switch', async () => {
    renderApp({ user: NARRATOR })
    const toggle = screen.getByRole('button', { name: /Simular conexión/ })
    expect(toggle).toHaveAttribute('data-offline', 'false')

    act(() => window.dispatchEvent(new Event('offline')))

    expect(toggle).toHaveTextContent('Sin señal')
    expect(toggle).toHaveAttribute('data-offline', 'true')
    expect(toggle).toHaveAttribute('aria-pressed', 'false') // the switch itself is off

    act(() => window.dispatchEvent(new Event('online')))

    expect(toggle).toHaveTextContent('En línea')
    expect(toggle).toHaveAttribute('data-offline', 'false')
  })

  it('tells the person when the signal goes and when it comes back', async () => {
    const user = userEvent.setup()
    renderApp({ user: NARRATOR })
    const toggle = screen.getByRole('button', { name: /Simular conexión/ })

    await user.click(toggle)
    expect(await screen.findByText('Sin señal: lo que cuentes se guarda en el dispositivo.')).toBeInTheDocument()

    await user.click(toggle)
    expect(await screen.findByText('Volvió la señal.')).toBeInTheDocument()
  })

  it('does not call the API while the demo switch simulates no signal, and reloads when it ends', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({ user: NARRATOR })
    await screen.findByText('0 publicadas')
    fetchMock.mockClear()

    await user.click(screen.getByRole('button', { name: /Simular conexión/ }))
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Simular conexión/ }))
    await screen.findByText('0 publicadas')
    expect(fetchMock).toHaveBeenCalled()
  })

  it('offers sign-in to visitors', () => {
    renderApp()

    expect(screen.getByRole('button', { name: /Ingresar/ })).toBeInTheDocument()
  })
})
