import { request } from './http.js'

/** Where the audio of a piece of public content is: "portada", "fincas" or "historias/HIS-2026-001". */
export const fetchVoice = (piece) => request(`/voz/${piece}`, { auth: false })
