import { request } from './http.js'

/** Creates a narrator account and signs in. Answers { token, usuario }. */
export const registerNarrator = ({ nombre, celular, pin }) =>
  request('/auth/registro', { method: 'POST', body: { nombre, celular, pin }, auth: false })

/** rol: "narrador" (celular + PIN) or "administrador" (usuario + contraseña). Answers { token, usuario }. */
export const signIn = ({ rol, usuario, clave }) =>
  request('/auth/ingreso', { method: 'POST', body: { rol, usuario, clave }, auth: false })

/** The user of the saved session. 401 means the session is no longer valid. */
export const fetchMe = () => request('/auth/yo')
