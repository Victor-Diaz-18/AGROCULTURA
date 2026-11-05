import { request } from './http.js'

/** Creates a narrator account and signs in. Answers { token, usuario }. */
export const registerNarrator = ({ nombre, celular, pin }) =>
  request('/auth/registro', { method: 'POST', body: { nombre, celular, pin }, auth: false })

/**
 * Signs in with a user name and a password; the server knows from the account what kind of person it is.
 * A narrator's are the mobile number and the PIN. Answers { token, usuario }.
 */
export const signIn = ({ usuario, clave }) =>
  request('/auth/ingreso', { method: 'POST', body: { usuario, clave }, auth: false })

/** The user of the saved session. 401 means the session is no longer valid. */
export const fetchMe = () => request('/auth/yo')
