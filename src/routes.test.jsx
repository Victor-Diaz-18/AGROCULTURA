import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR, fakeToken } from './test/auth.js'
import { callsTo, renderApp, reply } from './test/renderApp.jsx'

describe('/admin (F7)', () => {
  it('shows a visitor the team sign-in card and none of the panel', async () => {
    renderApp({ route: '/admin' })

    expect(await screen.findByRole('heading', { name: 'Acceso del equipo' })).toBeInTheDocument()
    expect(screen.getByText(/Solo para administradores: revisar historias/)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Secciones de administración' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Resumen' })).not.toBeInTheDocument()
  })

  it('rejects a narrator: same card, plus a note, and no panel', async () => {
    renderApp({ route: '/admin', user: NARRATOR })

    expect(await screen.findByRole('heading', { name: 'Acceso del equipo' })).toBeInTheDocument()
    expect(screen.getByText('Ingresaste como narrador.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Secciones de administración' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Resumen' })).not.toBeInTheDocument()
  })

  it('shows the panel to an administrator', async () => {
    renderApp({ route: '/admin', user: ADMIN })

    expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Secciones de administración' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Acceso del equipo' })).not.toBeInTheDocument()
  })

  it('opens the panel after the administrator signs in on the card', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderApp({
      route: '/admin',
      api: {
        '/auth/ingreso': () => reply({ token: fakeToken({ rol: 'administrador' }), usuario: ADMIN }),
        '/auth/yo': ADMIN,
      },
    })
    await screen.findByRole('heading', { name: 'Acceso del equipo' })

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Contraseña'), 'una-clave-larga-1234')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument()
    expect(JSON.parse(callsTo(fetchMock, '/auth/ingreso')[0][1].body).rol).toBe('administrador')
  })

  it('keeps the card and shows the message when the credentials are wrong', async () => {
    const user = userEvent.setup()
    renderApp({
      route: '/admin',
      api: { '/auth/ingreso': () => reply({ detail: 'Usuario o contraseña incorrectos.' }, 401) },
    })
    await screen.findByRole('heading', { name: 'Acceso del equipo' })

    await user.type(screen.getByLabelText('Usuario'), 'admin')
    await user.type(screen.getByLabelText('Contraseña'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.')
    expect(screen.queryByRole('heading', { name: 'Resumen' })).not.toBeInTheDocument()
  })

  it('goes back to the card when the administrator signs out', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/admin', user: ADMIN })
    await screen.findByRole('heading', { name: 'Resumen' })

    const header = screen.getByRole('banner')
    await user.click(within(header).getByRole('button', { name: 'Salir' }))

    expect(await screen.findByRole('heading', { name: 'Acceso del equipo' })).toBeInTheDocument()
  })
})
