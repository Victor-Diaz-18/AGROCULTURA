import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Records the narrator's voice with the browser's MediaRecorder (F5).
 * Mono, low bitrate (about 180 KB per minute) so the file is small enough to
 * upload on a weak connection. Chrome and Firefox write webm/opus; iPhones write mp4/aac.
 */

export const MAX_SECONDS = 600 // 10 minutes
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm', 'audio/ogg;codecs=opus']

export const MESSAGES = {
  unsupported: 'Este dispositivo no puede grabar audio. Escribe tu historia.',
  denied: 'No pudimos usar el micrófono. Permite el micrófono en tu navegador o escribe tu historia.',
  noMicrophone: 'No encontramos un micrófono. Escribe tu historia.',
  failed: 'Se cortó la grabación. Intenta de nuevo.',
  limit: 'Llegaste a los 10 minutos: guardamos tu audio hasta aquí.',
}

/** The first format this browser can record, or "" to let it choose. */
export function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return ''
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function canRecord() {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'
}

/**
 * `onRecorded({ blob, seconds, mime })` runs every time a recording ends, whether the
 * person stopped it or the 10 minute limit did.
 */
export default function useRecorder({ onRecorded, maxSeconds = MAX_SECONDS } = {}) {
  const [status, setStatus] = useState('idle') // idle | recording
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const recorder = useRef(null)
  const stream = useRef(null)
  const timer = useRef(null)
  const startedAt = useRef(0)
  const discard = useRef(false)
  const onRecordedRef = useRef(onRecorded)
  onRecordedRef.current = onRecorded

  const release = useCallback(() => {
    clearInterval(timer.current)
    stream.current?.getTracks().forEach((track) => track.stop()) // turns the microphone light off
    stream.current = null
  }, [])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const start = useCallback(async () => {
    setError('')
    setNotice('')
    if (!canRecord()) {
      setError(MESSAGES.unsupported)
      return false
    }
    let media
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
    } catch (failure) {
      const denied = failure?.name === 'NotAllowedError' || failure?.name === 'SecurityError'
      setError(denied ? MESSAGES.denied : MESSAGES.noMicrophone)
      return false
    }

    const mimeType = pickMimeType()
    const chunks = []
    discard.current = false
    stream.current = media
    const instance = new MediaRecorder(media, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24_000 })
    recorder.current = instance
    instance.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }
    instance.onerror = () => {
      release()
      setStatus('idle')
      setError(MESSAGES.failed)
    }
    instance.onstop = () => {
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
      release()
      setStatus('idle')
      if (discard.current || chunks.length === 0) return
      const type = instance.mimeType || mimeType || 'audio/webm'
      onRecordedRef.current?.({ blob: new Blob(chunks, { type }), seconds: Math.min(elapsed, maxSeconds), mime: type })
    }

    startedAt.current = Date.now()
    instance.start(1000) // a chunk per second: little is lost if the page dies
    setSeconds(0)
    setStatus('recording')
    timer.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000
      setSeconds(Math.floor(elapsed))
      if (elapsed >= maxSeconds) {
        setNotice(MESSAGES.limit)
        stop()
      }
    }, 250)
    return true
  }, [maxSeconds, release, stop])

  // Leaving the page while recording discards it and frees the microphone.
  useEffect(
    () => () => {
      discard.current = true
      if (recorder.current?.state === 'recording') recorder.current.stop()
      release()
    },
    [release],
  )

  return { status, seconds, error, notice, supported: canRecord(), start, stop }
}
