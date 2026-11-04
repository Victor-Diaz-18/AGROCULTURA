import { request } from './http.js'

/** Portal name, sectors, tags, epochs and rejection reasons. */
export const fetchConfig = () => request('/config', { auth: false })

/** Counters for the header and the summary cards. */
export const fetchStats = () => request('/estadisticas', { auth: false })
