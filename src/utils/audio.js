/** Length in seconds of an audio file the person picked, or null if the browser cannot tell (or it takes too long). */
export function readAudioDuration(file, timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (typeof URL.createObjectURL !== 'function' || typeof document === 'undefined') {
      resolve(null)
      return
    }
    const url = URL.createObjectURL(file)
    const probe = document.createElement('audio')
    const finish = (value) => {
      clearTimeout(timer)
      probe.removeAttribute('src')
      URL.revokeObjectURL?.(url)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => finish(Number.isFinite(probe.duration) ? Math.round(probe.duration) : null)
    probe.onerror = () => finish(null)
    probe.src = url
  })
}
