import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR } from '../test/auth.js'
import { STATS } from '../test/fixtures.js'
import { renderApp, reply } from '../test/renderApp.jsx'

const cards = () => within(screen.getByRole('list')).getAllByRole('link')

describe('«Inicio»: todas las acciones en tarjetas', () => {
  it('al narrador le ofrece contar, ver el mapa, revisar sus historias y lo que viene', async () => {
    renderApp({ route: '/inicio', user: NARRATOR, api: { '/historias/mias': [] } })

    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument()
    const names = cards().map((card) => card.textContent)
    expect(names[0]).toMatch(/Contar una nueva historia/)
    expect(names.join(' ')).toMatch(/Ver el mapa de historias.*Revisar mis historias.*Lo que viene/)
    expect(screen.getByRole('link', { name: /Contar una nueva historia/ })).toHaveAttribute('href', '/contar')
  })

  it('al administrador le ofrece revisar (con cuántas esperan), crear, configurar y lo demás', async () => {
    renderApp({ route: '/admin/inicio', user: ADMIN, api: { '/estadisticas': { ...STATS, en_revision: 4 } } })

    const review = await screen.findByRole('link', { name: /Revisar historias/ })
    expect(review).toHaveAttribute('href', '/admin/revision')
    expect(await within(review).findByText('4')).toBeInTheDocument()
    for (const name of [/Crear una historia del proyecto/, /Historias del proyecto/, /Ver el resumen/, /Ver el mapa público/, /Configuración/]) {
      expect(within(screen.getByRole('main')).getByRole('link', { name })).toBeInTheDocument()
    }
  })

  it('es a donde llega el narrador al ingresar sin un destino', async () => {
    const user = userEvent.setup()
    renderApp({ api: { '/auth/ingreso': () => reply({ token: 'x.y.z', usuario: NARRATOR }), '/historias/mias': [] } })
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: /Ingresar/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ingresar' })
    await user.type(within(dialog).getByLabelText('Usuario'), 'ana')
    await user.type(within(dialog).getByLabelText('Contraseña'), 'clave segura{Enter}')

    expect(await screen.findByText('¿Qué quieres hacer?')).toBeInTheDocument()
  })
})
