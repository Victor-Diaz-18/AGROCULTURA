import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR } from './test/auth.js'
import { renderApp } from './test/renderApp.jsx'

describe('App', () => {
  it('opens on the map page inside the portal frame', async () => {
    renderApp()

    expect(await screen.findByRole('heading', { name: 'Mapa de historias' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument()
  })

  it('moves between pages from the side menu', async () => {
    const user = userEvent.setup()
    renderApp({ user: NARRATOR })

    await user.click(screen.getByRole('link', { name: /Contar una historia/ }))

    expect(await screen.findByRole('heading', { name: 'Contar una historia' })).toBeInTheDocument()
  })

  it('shows the admin frame under /admin to an administrator', async () => {
    renderApp({ route: '/admin', user: ADMIN })

    expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Secciones de administración' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver portal público/ })).toBeInTheDocument()
  })

  it('shows the future-phase pages as announced, not built', async () => {
    renderApp({ route: '/proximamente/ra' })

    expect(await screen.findByRole('heading', { name: 'Avatares en realidad aumentada' })).toBeInTheDocument()
    expect(screen.getByText('FASE FUTURA · F15')).toBeInTheDocument()
    expect(screen.getByText('No se construye en esta entrega')).toBeInTheDocument()
  })
})
