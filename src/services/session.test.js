import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeToken } from '../test/auth.js'
import {
  clearSession,
  decodeToken,
  getToken,
  isTokenExpired,
  loadSession,
  saveSession,
} from './session.js'

const USER = { id: 'u1', nombre: 'Ana Beltrán', rol: 'narrador' }

afterEach(() => vi.unstubAllGlobals())

describe('session storage', () => {
  it('saves and restores a session', () => {
    const token = fakeToken()
    saveSession({ token, user: USER })

    expect(loadSession()).toEqual({ token, user: USER })
    expect(getToken()).toBe(token)
  })

  it('forgets the session when it is cleared', () => {
    saveSession({ token: fakeToken(), user: USER })

    clearSession()

    expect(loadSession()).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('does not restore a session whose token already expired', () => {
    saveSession({ token: fakeToken({ exp: Math.floor(Date.now() / 1000) - 60 }), user: USER })

    expect(loadSession()).toBeNull()
  })

  it('does not restore a session with a malformed token or user', () => {
    localStorage.setItem('agrocultura.token', 'not-a-jwt')
    localStorage.setItem('agrocultura.user', JSON.stringify(USER))
    expect(loadSession()).toBeNull()

    localStorage.setItem('agrocultura.token', fakeToken())
    localStorage.setItem('agrocultura.user', '{broken')
    expect(loadSession()).toBeNull()
  })

  it('reads the expiry of a token without verifying it', () => {
    const exp = Math.floor(Date.now() / 1000) + 100

    expect(decodeToken(fakeToken({ exp })).exp).toBe(exp)
    expect(isTokenExpired(fakeToken({ exp }))).toBe(false)
    expect(isTokenExpired(fakeToken({ exp }), (exp + 1) * 1000)).toBe(true)
    expect(decodeToken('garbage')).toBeNull()
  })

  it('keeps working when the browser blocks storage', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
      removeItem() {
        throw new Error('blocked')
      },
    })

    expect(() => saveSession({ token: fakeToken(), user: USER })).not.toThrow()
    expect(loadSession()).toBeNull()
    expect(() => clearSession()).not.toThrow()
  })
})
