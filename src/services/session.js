/**
 * Where the session lives in the browser. Storage can be blocked (private mode),
 * so every access is guarded. The token is a JWT: we only read its expiry here;
 * the server is the one that really verifies it.
 */

const TOKEN_KEY = 'agrocultura.token'
const USER_KEY = 'agrocultura.user'

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* without storage the person simply has to sign in again next time */
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing to clear */
  }
}

export function getToken() {
  return read(TOKEN_KEY)
}

export function setToken(token) {
  write(TOKEN_KEY, token)
}

export function clearToken() {
  remove(TOKEN_KEY)
}

/** Claims of a JWT (not verified), or null if it is malformed. */
export function decodeToken(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export function isTokenExpired(token, nowMs = Date.now()) {
  const claims = decodeToken(token)
  return !claims || typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs
}

/** The saved session ({ token, user }), or null when there is none or it already expired. */
export function loadSession() {
  const token = read(TOKEN_KEY)
  const rawUser = read(USER_KEY)
  if (!token || !rawUser || isTokenExpired(token)) return null
  try {
    const user = JSON.parse(rawUser)
    return user && user.rol ? { token, user } : null
  } catch {
    return null
  }
}

export function saveSession({ token, user }) {
  write(TOKEN_KEY, token)
  write(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  remove(TOKEN_KEY)
  remove(USER_KEY)
}
