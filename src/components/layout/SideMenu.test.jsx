import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { NARRATOR } from '../../test/auth.js'
import { STATS } from '../../test/fixtures.js'
import { renderApp } from '../../test/renderApp.jsx'

describe('SideMenu', () => {
  it('groups the entries as in the design', () => {
    renderApp({ user: NARRATOR })
    const nav = screen.getByRole('navigation', { name: 'Secciones' })

    for (const title of ['EXPLORAR', 'NARRADOR', 'ADMINISTRACIÓN', 'PRÓXIMAMENTE']) {
      expect(within(nav).getByText(title)).toBeInTheDocument()
    }
    expect(within(nav).getByText(/Cada página tiene un botón «Escuchar»/)).toBeInTheDocument()
  })

  it('locks the administration entries for people who are not administrators', () => {
    renderApp({ user: NARRATOR })
    const nav = screen.getByRole('navigation', { name: 'Secciones' })

    expect(within(nav).getAllByRole('img', { name: 'Solo administradores' })).toHaveLength(3)
  })

  it('marks the current page', () => {
    renderApp({ user: NARRATOR, route: '/proximamente/ra' })
    const nav = screen.getByRole('navigation', { name: 'Secciones' })

    expect(within(nav).getByRole('link', { name: /Avatares en RA/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: /Mapa de historias/ })).not.toHaveAttribute('aria-current')
  })

  it('shows how many stories are published and how many wait for review', async () => {
    renderApp({ user: NARRATOR, api: { '/estadisticas': { ...STATS, publicadas: 7, en_revision: 4 } } })
    const nav = screen.getByRole('navigation', { name: 'Secciones' })

    expect(await within(nav).findByText('7')).toBeInTheDocument()
    // The review count is hidden behind the lock until an administrator signs in.
    expect(within(nav).queryByText('4')).not.toBeInTheDocument()
  })

  it('lists the future phases F14 and F15', () => {
    renderApp({ user: NARRATOR })
    const nav = screen.getByRole('navigation', { name: 'Secciones' })

    expect(within(nav).getByRole('link', { name: /Recorridos 360°/ })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Avatares en RA/ })).toBeInTheDocument()
  })
})
