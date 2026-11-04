import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN, NARRATOR } from '../../test/auth.js'
import { CONFIG } from '../../test/fixtures.js'
import { callsTo, renderApp, reply } from '../../test/renderApp.jsx'

/** A configuration that changes like the server's does. */
function settingsApi({ reset = false, failTag = null, resetAnswer = null } = {}) {
  const config = structuredClone({ ...CONFIG, portal: { ...CONFIG.portal, reinicio_disponible: reset } })
  return {
    config,
    api: {
      '/config': () => structuredClone(config),
      '/admin/portal': (init) => {
        const changes = JSON.parse(init.body)
        if (changes.nombre !== undefined) config.portal.nombre = changes.nombre
        if (changes.avisar_rechazo !== undefined) config.portal.avisar_rechazo = changes.avisar_rechazo
        if (changes.datos_de_ejemplo !== undefined) config.portal.datos_de_ejemplo = changes.datos_de_ejemplo
        return config.portal
      },
      '/admin/etiquetas': (init, url) => {
        if (init.method === 'DELETE') {
          const name = new URL(url, 'http://x').searchParams.get('nombre')
          config.etiquetas = config.etiquetas.filter((tag) => tag !== name)
        } else {
          if (failTag) return reply({ detail: failTag }, 409)
          config.etiquetas = [...config.etiquetas, JSON.parse(init.body).nombre.toLowerCase().replace(/^(?!#)/, '#')]
        }
        return config.etiquetas
      },
      '/admin/reiniciar-ejemplo': () => resetAnswer ?? { historias_borradas: 3, historias_de_ejemplo: 12, archivos_borrados: 2 },
    },
  }
}

const open = (variant = 'admin', options) => {
  const settings = settingsApi(options)
  const view = renderApp({ route: variant === 'admin' ? '/admin/configuracion' : '/configuracion', user: ADMIN, api: settings.api })
  return { ...view, ...settings }
}
const bodyOf = (fetchMock, path, index = 0) => JSON.parse(callsTo(fetchMock, path)[index][1].body)

describe('Configuración: portal y moderación (F7)', () => {
  it('shows the current name, the fixed moderation rule and the two options', async () => {
    open()

    expect(await screen.findByLabelText('Nombre del portal')).toHaveValue('AGROCULTURA')
    expect(screen.getByRole('switch', { name: /Toda historia pasa por revisión/ })).toBeDisabled()
    expect(screen.getByRole('switch', { name: /Toda historia pasa por revisión/ })).toBeChecked()
    expect(screen.getByRole('switch', { name: /Avisar al narrador si se rechaza/ })).not.toBeChecked()
    expect(screen.getByText('El nombre definitivo está por confirmar con el profesor.')).toBeInTheDocument()
  })

  it('saves the name when the field is left and the whole app shows it', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const input = await screen.findByLabelText('Nombre del portal')

    await user.clear(input)
    await user.type(input, '  Memoria   Cafetera ')
    await user.tab()

    expect(await screen.findByText('Nombre del portal guardado.')).toBeInTheDocument()
    expect(bodyOf(fetchMock, '/admin/portal')).toEqual({ nombre: 'Memoria Cafetera' })
    expect(await screen.findAllByText('Memoria Cafetera')).not.toHaveLength(0) // the header, from the reloaded configuration
  })

  it('saves with Enter too', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const input = await screen.findByLabelText('Nombre del portal')

    await user.clear(input)
    await user.type(input, 'Otro nombre{Enter}')

    await waitFor(() => expect(callsTo(fetchMock, '/admin/portal')).toHaveLength(1))
  })

  it('does not call the server when the name did not change', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const input = await screen.findByLabelText('Nombre del portal')

    await user.click(input)
    await user.tab()

    expect(callsTo(fetchMock, '/admin/portal')).toHaveLength(0)
  })

  it('does not accept a name that is too short', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const input = await screen.findByLabelText('Nombre del portal')

    await user.clear(input)
    await user.type(input, 'A')
    await user.tab()

    expect(await screen.findByRole('alert')).toHaveTextContent('entre 2 y 60 letras')
    expect(callsTo(fetchMock, '/admin/portal')).toHaveLength(0)
  })

  it('turns "avisar al narrador" on and off', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const toggle = await screen.findByRole('switch', { name: /Avisar al narrador/ })

    await user.click(toggle)

    await waitFor(() => expect(toggle).toBeChecked())
    expect(bodyOf(fetchMock, '/admin/portal')).toEqual({ avisar_rechazo: true })
    await user.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
  })

  it('lets the team turn off the "datos de ejemplo" label before real use', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const toggle = await screen.findByRole('switch', { name: /Mostrar «datos de ejemplo»/ })
    expect(toggle).toBeChecked()

    await user.click(toggle)

    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(bodyOf(fetchMock, '/admin/portal')).toEqual({ datos_de_ejemplo: false })
  })

  it('shows the sectors but there is nothing to edit in them', async () => {
    open()

    const card = (await screen.findByRole('region', { name: 'Sectores del mapa' }))
    expect(within(card).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Minca', 'La Tagua', 'San Lorenzo', 'Tijereras'])
    expect(within(card).queryByRole('button')).not.toBeInTheDocument()
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('works the same way inside the portal', async () => {
    open('portal')

    expect(await screen.findByLabelText('Nombre del portal')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Datos de ejemplo' })).not.toBeInTheDocument()
  })

  it('a narrator cannot get to the settings', () => {
    renderApp({ route: '/configuracion', user: NARRATOR })

    expect(screen.queryByLabelText('Nombre del portal')).not.toBeInTheDocument()
  })
})

describe('Configuración: etiquetas', () => {
  it('lists the tags and adds a new one', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const card = await screen.findByRole('region', { name: 'Etiquetas' })
    expect(within(card).getByText('#café')).toBeInTheDocument()

    await user.type(within(card).getByLabelText('Nueva etiqueta'), 'arriería')
    await user.click(within(card).getByRole('button', { name: 'Agregar' }))

    expect(await within(card).findByText('#arriería')).toBeInTheDocument()
    expect(bodyOf(fetchMock, '/admin/etiquetas')).toEqual({ nombre: 'arriería' })
    expect(within(card).getByLabelText('Nueva etiqueta')).toHaveValue('')
  })

  it('adds with Enter and ignores an empty field', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const card = await screen.findByRole('region', { name: 'Etiquetas' })

    await user.click(within(card).getByRole('button', { name: 'Agregar' }))
    expect(callsTo(fetchMock, '/admin/etiquetas')).toHaveLength(0)
    await user.type(within(card).getByLabelText('Nueva etiqueta'), '#trilla{Enter}')

    expect(await within(card).findByText('#trilla')).toBeInTheDocument()
  })

  it('says why a tag was not added', async () => {
    const user = userEvent.setup()
    open('admin', { failTag: 'La etiqueta #café ya existe.' })
    const card = await screen.findByRole('region', { name: 'Etiquetas' })

    await user.type(within(card).getByLabelText('Nueva etiqueta'), 'café')
    await user.click(within(card).getByRole('button', { name: 'Agregar' }))

    expect(await within(card).findByRole('alert')).toHaveTextContent('ya existe')
    expect(within(card).getByLabelText('Nueva etiqueta')).toHaveValue('café')
  })

  it('removes a tag', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open()
    const card = await screen.findByRole('region', { name: 'Etiquetas' })

    await user.click(within(card).getByRole('button', { name: 'Quitar #cocina' }))

    await waitFor(() => expect(within(card).queryByText('#cocina')).not.toBeInTheDocument())
    expect(callsTo(fetchMock, '/admin/etiquetas')[0][0]).toContain('nombre=%23cocina')
    expect(callsTo(fetchMock, '/admin/etiquetas')[0][1].method).toBe('DELETE')
  })
})

describe('Configuración: reiniciar datos de ejemplo (quitable)', () => {
  const card = () => screen.findByRole('region', { name: 'Datos de ejemplo' })

  it('does not exist when the server does not allow it', async () => {
    open('admin', { reset: false })
    await screen.findByLabelText('Nombre del portal')

    expect(screen.queryByRole('button', { name: 'Reiniciar datos de ejemplo' })).not.toBeInTheDocument()
  })

  it('warns clearly that ALL the stories are deleted, the real ones too', async () => {
    const user = userEvent.setup()
    open('admin', { reset: true })

    await user.click(within(await card()).getByRole('button', { name: 'Reiniciar datos de ejemplo' }))

    const dialog = await screen.findByRole('dialog', { name: 'Reiniciar datos de ejemplo' })
    expect(within(dialog).getByRole('heading', { name: '¿Borrar todas las historias?' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('todas las historias de la plataforma, incluidas las reales')
    expect(dialog).toHaveTextContent('No se puede deshacer')
  })

  it('will not do it until the word is typed', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open('admin', { reset: true })
    await user.click(within(await card()).getByRole('button', { name: 'Reiniciar datos de ejemplo' }))
    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Borrar todo y reiniciar' })

    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/escribe REINICIAR/), 'reinicia')
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/escribe REINICIAR/), 'r')
    expect(confirm).toBeEnabled()
    expect(callsTo(fetchMock, '/admin/reiniciar-ejemplo')).toHaveLength(0)
  })

  it('does it, says how many stories went and came, and closes', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open('admin', { reset: true })
    await user.click(within(await card()).getByRole('button', { name: 'Reiniciar datos de ejemplo' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/escribe REINICIAR/), 'REINICIAR')
    await user.click(within(dialog).getByRole('button', { name: 'Borrar todo y reiniciar' }))

    expect(await screen.findByText('Listo: se borraron 3 historias y se cargaron 12 de ejemplo.')).toBeInTheDocument()
    expect(JSON.parse(callsTo(fetchMock, '/admin/reiniciar-ejemplo')[0][1].body)).toEqual({ confirmar: true })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('cancelling deletes nothing', async () => {
    const user = userEvent.setup()
    const { fetchMock } = open('admin', { reset: true })
    await user.click(within(await card()).getByRole('button', { name: 'Reiniciar datos de ejemplo' }))

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, '/admin/reiniciar-ejemplo')).toHaveLength(0)
  })

  it('shows what the server said when it refuses, and nothing was deleted', async () => {
    const user = userEvent.setup()
    open('admin', { reset: true, resetAnswer: reply({ detail: 'El reinicio de datos de ejemplo está desactivado en este servidor.' }, 403) })
    await user.click(within(await card()).getByRole('button', { name: 'Reiniciar datos de ejemplo' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/escribe REINICIAR/), 'REINICIAR')
    await user.click(within(dialog).getByRole('button', { name: 'Borrar todo y reiniciar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('desactivado')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
