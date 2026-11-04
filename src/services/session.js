/** Where the session token lives in the browser. Storage can be blocked, so every access is guarded. */

const TOKEN_KEY = 'agrocultura.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* without storage the user simply has to sign in again next time */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* nothing to clear */
  }
}
