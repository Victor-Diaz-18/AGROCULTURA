/**
 * Single door to the API. Every service goes through `request`.
 *
 * - Refuses to touch the network when the app is effectively offline
 *   (real connection down or the "Simular conexión" demo switch), so the
 *   demo behaves like a phone without signal.
 * - Sends the session token when there is one.
 * - Turns errors into OfflineError (no network) or ApiError (server answered).
 */

import { isOnline } from '../offline/connectivity.js'
import { getToken } from './session.js'

export class OfflineError extends Error {
  constructor() {
    super('Sin conexión')
    this.name = 'OfflineError'
  }
}

export class ApiError extends Error {
  constructor(status, detail, code) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function request(path, { method = 'GET', body, headers, auth = true, signal } = {}) {
  if (!isOnline()) throw new OfflineError()

  const finalHeaders = { Accept: 'application/json', ...headers }
  let payload
  if (body instanceof FormData) {
    payload = body // the browser sets the multipart boundary
  } else if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const token = auth ? getToken() : null
  if (token) finalHeaders.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`/api${path}`, { method, headers: finalHeaders, body: payload, signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new OfflineError() // network failure: fetch rejects with a TypeError
  }

  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'Algo salió mal. Intenta de nuevo.'
    throw new ApiError(response.status, detail, data?.code)
  }
  return data
}
