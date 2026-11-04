import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import AppProviders from '../AppProviders.jsx'
import AppRoutes from '../routes.jsx'
import { signedInAs } from './auth.js'
import { CONFIG, STATS } from './fixtures.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** An API answer with a status, for `api` entries that are functions: `() => reply({ detail: '...' }, 401)`. */
export const reply = jsonResponse

/**
 * Renders the whole app on a route with the API stubbed.
 *  - `api` maps a path (e.g. "/estadisticas") to its JSON answer, or to a function
 *    `(requestInit) => answer` (use `reply(body, status)` to choose the status). A function may return
 *    a promise, to keep a request pending.
 *  - `user` starts the test signed in as that person (and answers /auth/yo for them).
 */
export function renderApp({ route = '/', api = {}, user = null } = {}) {
  if (user) signedInAs(user)
  const answers = { '/config': CONFIG, '/estadisticas': STATS, ...(user ? { '/auth/yo': user } : {}), ...api }
  const fetchMock = vi.fn(async (url, init) => {
    const path = String(url).replace(/^\/api/, '').split('?')[0]
    if (!(path in answers)) return jsonResponse({ detail: 'No encontrado' }, 404)
    const answer = answers[path]
    const result = await (typeof answer === 'function' ? answer(init) : answer) // may be a promise: tests hold a request open
    return result instanceof Response ? result : jsonResponse(result)
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

/** The calls made to one API path: [[url, init], ...]. */
export const callsTo = (fetchMock, path) => fetchMock.mock.calls.filter(([url]) => url === `/api${path}`)
