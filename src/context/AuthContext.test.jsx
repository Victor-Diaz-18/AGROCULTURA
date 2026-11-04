import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setSimulatedOffline } from '../offline/connectivity.js'
import { NARRATOR, fakeToken } from '../test/auth.js'
import { callsTo, renderApp, reply } from '../test/renderApp.jsx'

describe('session', () => {
  it('is restored at start-up, with no sign-in', async () => {
    renderApp({ user: NARRATOR })

    expect(screen.getByText('Ana Beltrán')).toBeInTheDocument()
    expect(screen.getByText(/Narrador/, { selector: '.ag-user__role' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument()
  })

  it('is not restored when its token already expired', () => {
    localStorage.setItem('agrocultura.token', fakeToken({ exp: Math.floor(Date.now() / 1000) - 60 }))
    localStorage.setItem('agrocultura.user', JSON.stringify(NARRATOR))

    renderApp()

    expect(screen.getByRole('button', { name: /Ingresar/ })).toBeInTheDocument()
    expect(screen.queryByText('Ana Beltrán')).not.toBeInTheDocument()
  })

  it('ends when the server says the session is no longer valid', async () => {
    renderApp({ user: NARRATOR, api: { '/auth/yo': () => reply({ detail: 'Tu sesión no es válida o venció.' }, 401) } })

    expect(await screen.findByRole('button', { name: /Ingresar/ })).toBeInTheDocument()
    expect(localStorage.getItem('agrocultura.token')).toBeNull()
  })

  it('survives other server problems', async () => {
    const { fetchMock } = renderApp({ user: NARRATOR, api: { '/auth/yo': () => reply({ detail: 'Error' }, 500) } })

    await waitFor(() => expect(callsTo(fetchMock, '/auth/yo')).toHaveLength(1))
    expect(screen.getByText('Ana Beltrán')).toBeInTheDocument()
    expect(localStorage.getItem('agrocultura.token')).not.toBeNull()
  })

  it('stays signed in with no signal, and does not ask the server', () => {
    setSimulatedOffline(true)

    const { fetchMock } = renderApp({ user: NARRATOR })

    expect(screen.getByText('Ana Beltrán')).toBeInTheDocument()
    expect(callsTo(fetchMock, '/auth/yo')).toHaveLength(0)
  })

  it('sends the session token to the server', async () => {
    const { fetchMock } = renderApp({ user: NARRATOR })

    await waitFor(() => expect(callsTo(fetchMock, '/auth/yo')).toHaveLength(1))
    expect(callsTo(fetchMock, '/auth/yo')[0][1].headers.Authorization).toMatch(/^Bearer /)
  })

  it('is forgotten on sign-out, with a message', async () => {
    const user = userEvent.setup()
    renderApp({ user: NARRATOR })

    await user.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await screen.findByText('Sesión cerrada.')).toBeInTheDocument()
    expect(localStorage.getItem('agrocultura.token')).toBeNull()
    expect(localStorage.getItem('agrocultura.user')).toBeNull()
    expect(screen.getByRole('button', { name: /Ingresar/ })).toBeInTheDocument()
  })
})
