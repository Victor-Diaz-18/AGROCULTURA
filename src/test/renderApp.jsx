import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import AppProviders from '../AppProviders.jsx'
import AppRoutes from '../routes.jsx'
import { CONFIG, STATS } from './fixtures.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Renders the whole app on a route with the API stubbed.
 * `api` maps a path (e.g. "/estadisticas") to its JSON answer; config and stats have defaults.
 */
export function renderApp({ route = '/', api = {} } = {}) {
  const answers = { '/config': CONFIG, '/estadisticas': STATS, ...api }
  const fetchMock = vi.fn(async (url) => {
    const path = String(url).replace(/^\/api/, '').split('?')[0]
    return path in answers ? jsonResponse(answers[path]) : jsonResponse({ detail: 'No encontrado' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)

  const view = render(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
  return { ...view, fetchMock }
}
