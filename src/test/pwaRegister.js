/** Stands in for the service worker plugin's `virtual:pwa-register` in the tests: it lets a test play the browser. */
export const pwa = { options: null, registration: null, updated: 0 }

export function registerSW(options) {
  pwa.options = options
  return async () => {
    pwa.updated += 1 // "Actualizar": the page would reload with the new version
  }
}
