import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { ADMIN, NARRATOR } from '../../test/auth.js'
import { STATS } from '../../test/fixtures.js'
import { renderApp } from '../../test/renderApp.jsx'

describe('SideMenu', () => {
  it('groups the entries as in the design', () => {
    renderApp({ user: ADMIN })
    const nav = screen.getByRole('navigation', { name: 'Secciones' })

    for (const title of ['EXPLORAR', 'NARRADOR', 'ADMINISTRACIÓN', 'PRÓXIMAMENTE']) {
      expect(within(nav).getByText(title)).toBeInTheDocument()
    }
    expect(within(nav).getByText(/Cada página tiene un botón «Escuchar»/)).toBeInTheDocument()
  })

  it('is only for the team: a narrator never sees the administration entries', () => {
    renderApp({ user: NARRATOR })

    expect(screen.queryByText('ADMINISTRACIÓN')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Revisión|Configuración|Historias propias/ })).not.toBeInTheDocument()
  })

  it('marks the current page', () => {
    renderApp({ user: ADMIN, route: '/proximamente/ra' })
    const nav = screen.getByRole('navigation', { name: 'Secciones' })

    expect(within(nav).getByRole('link', { name: /Avatares en RA/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: /Mapa de historias/ })).not.toHaveAttribute('aria-current')
  })

  it('shows how many stories are published and how many wait for review', async () => {
    renderApp({ user: ADMIN, api: { '/estadisticas': { ...STATS, publicadas: 7, en_revision: 4 } } })
    const nav = screen.getByRole('navigation', { name: 'Secciones' })

    expect(await within(nav).findByText('7')).toBeInTheDocument()
    expect(await within(nav).findByText('4')).toBeInTheDocument() // the team sees what waits for review
  })

  it('lists the future phases F14 and F15', () => {
    renderApp({ user: ADMIN })
    const nav = screen.getByRole('navigation', { name: 'Secciones' })

    expect(within(nav).getByRole('link', { name: /Recorridos 360°/ })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Avatares en RA/ })).toBeInTheDocument()
  })
})
