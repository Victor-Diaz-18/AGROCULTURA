/** Helpers to start a test already signed in (the token is fake: the server is stubbed anyway). */

export const NARRATOR = { id: 'u1', nombre: 'Ana Beltrán', rol: 'narrador' }
/** The main administrator (the one from ADMIN_USER). OTHER_ADMIN is one it created: it cannot manage administrators. */
export const ADMIN = { id: 'a1', nombre: 'Administración', rol: 'administrador', principal: true }
export const OTHER_ADMIN = { id: 'a2', nombre: 'Jeison', rol: 'administrador', principal: false }

const base64url = (value) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

/** An unsigned JWT-shaped string that expires in an hour (or at `exp`, in seconds). */
export function fakeToken({ exp = Math.floor(Date.now() / 1000) + 3600, rol = 'narrador' } = {}) {
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: 'u1', rol, exp })}.firma`
}

export function signedInAs(user, options) {
  localStorage.setItem('agrocultura.token', fakeToken({ ...options, rol: user.rol }))
  localStorage.setItem('agrocultura.user', JSON.stringify(user))
}
