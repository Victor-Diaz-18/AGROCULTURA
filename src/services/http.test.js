import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetConnectivityForTests, setSimulatedOffline } from '../offline/connectivity.js'
import { ApiError, OfflineError, request } from './http.js'
import { setToken } from './session.js'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => resetConnectivityForTests())
afterEach(() => vi.unstubAllGlobals())

describe('request', () => {
  it('does not touch the network while the demo switch says "sin señal"', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setSimulatedOffline(true)

    await expect(request('/config')).rejects.toBeInstanceOf(OfflineError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a failed network call as OfflineError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(request('/config')).rejects.toBeInstanceOf(OfflineError)
  })

  it('returns the parsed JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ publicadas: 3 })))

    await expect(request('/estadisticas')).resolves.toEqual({ publicadas: 3 })
  })

  it('turns an error answer into an ApiError with the server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Falta el motivo.', code: 'datos_invalidos' }, 422)),
    )

    const error = await request('/x', { method: 'POST', body: {} }).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, message: 'Falta el motivo.', code: 'datos_invalidos' })
  })

  it('sends the session token and the JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    setToken('abc123')

    await request('/historias', { method: 'POST', body: { titulo: 'Hola' } })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/historias')
    expect(options.headers.Authorization).toBe('Bearer abc123')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe('{"titulo":"Hola"}')
  })

  it('does not send the token to public endpoints when auth is off', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    setToken('abc123')

    await request('/config', { auth: false })

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })
})
