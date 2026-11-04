import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR, fakeToken } from '../../test/auth.js'
import { renderApp, reply } from '../../test/renderApp.jsx'

const heading = (name) => screen.findByRole('heading', { name })

describe('pages that need a role', () => {
  it('sends a visitor from "Contar una historia" to the map and asks them to sign in as a narrator', async () => {
    renderApp({ route: '/contar' })

    const dialog = await screen.findByRole('dialog', { name: 'Ingresar' })
    expect(within(dialog).getByText('Para contar una historia necesitas ingresar.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Narrador · F2' })).toHaveAttribute('aria-pressed', 'true')
    expect(await heading('Mapa de historias')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Contar una historia' })).not.toBeInTheDocument()
  })

  it('asks a visitor for administrator access on the review page', async () => {
    renderApp({ route: '/revision' })

    const dialog = await screen.findByRole('dialog', { name: 'Ingresar' })
    expect(within(dialog).getByText('Esta sección es solo para administradores.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Administrador · F7' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: 'Revisión de historias' })).not.toBeInTheDocument()
  })

  it('lets a narrator into the narrator pages without any dialog', async () => {
    renderApp({ route: '/contar', user: NARRATOR })

    expect(await heading('Contar una historia')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('refuses a narrator on an administrator page', async () => {
    renderApp({ route: '/revision', user: NARRATOR })

    const dialog = await screen.findByRole('dialog', { name: 'Ingresar' })
    expect(within(dialog).getByRole('button', { name: 'Administrador · F7' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: 'Revisión de historias' })).not.toBeInTheDocument()
  })

  it('lets an administrator into the administrator pages', async () => {
    renderApp({ route: '/revision', user: ADMIN })

    expect(await heading('Revisión de historias')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('takes the person to the page they wanted after signing in', async () => {
    const user = userEvent.setup()
    renderApp({
      route: '/contar',
      api: { '/auth/ingreso': () => reply({ token: fakeToken(), usuario: NARRATOR }), '/auth/yo': NARRATOR },
    })
    const dialog = await screen.findByRole('dialog', { name: 'Ingresar' })

    await user.click(within(dialog).getByRole('button', { name: 'Ya tengo cuenta' }))
    await user.type(within(dialog).getByLabelText('Número de celular'), '3005550192')
    await user.type(within(dialog).getByLabelText('Tu clave'), '4821')
    await user.click(within(dialog).getByRole('button', { name: 'Ingresar' }))

    expect(await heading('Contar una historia')).toBeInTheDocument()
  })

  it('asks for sign-in from the side menu without leaving the current page', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/proximamente/ra' })

    await user.click(screen.getByRole('link', { name: /Contar una historia/ }))

    expect(screen.getByRole('dialog', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Avatares en realidad aumentada' })).toBeInTheDocument()
  })

  it('asks a narrator for administrator access from the locked menu entries', async () => {
    const user = userEvent.setup()
    renderApp({ user: NARRATOR })

    await user.click(screen.getByRole('link', { name: /Revisión/ }))

    const dialog = screen.getByRole('dialog', { name: 'Ingresar' })
    expect(within(dialog).getByRole('button', { name: 'Administrador · F7' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not reopen the sign-in dialog when someone signs out on a protected page', async () => {
    const user = userEvent.setup()
    renderApp({ route: '/contar', user: NARRATOR })
    await heading('Contar una historia')

    await user.click(screen.getByRole('button', { name: 'Salir' }))

    expect(await heading('Mapa de historias')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
