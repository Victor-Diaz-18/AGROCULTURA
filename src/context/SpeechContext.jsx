import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Icon from '../components/ui/Icon.jsx'
import { useToast } from './ToastContext.jsx'

/**
 * Voice guide (F9): reads a page aloud with the browser's speech synthesis, in
 * Spanish. The "Leyendo en voz alta" bar shows what is being read and stops it.
 */

const SpeechContext = createContext({
  supported: false,
  reading: '',
  speak: () => false,
  stop: () => {},
})

const MAX_CHUNK = 220 // long utterances get cut off by some browsers; read in pieces

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined)

/** Splits text on sentence ends and packs the sentences into chunks of at most MAX_CHUNK characters. */
export function splitForSpeech(text) {
  const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…:;])\s+/)
  const chunks = []
  let current = ''
  for (const sentence of sentences) {
    if (current && (current + ' ' + sentence).length > MAX_CHUNK) {
      chunks.push(current)
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current) chunks.push(current)
  return chunks.filter(Boolean)
}

/** Prefers Colombian Spanish, then any Latin American Spanish, then any Spanish voice. */
function pickSpanishVoice() {
  const voices = synth()?.getVoices?.() ?? []
  const byPrefix = (prefix) => voices.find((voice) => voice.lang?.toLowerCase().startsWith(prefix))
  return byPrefix('es-co') ?? byPrefix('es-mx') ?? byPrefix('es-us') ?? byPrefix('es-419') ?? byPrefix('es')
}

export function SpeechProvider({ children }) {
  const supported = Boolean(synth()) && typeof SpeechSynthesisUtterance !== 'undefined'
  const [reading, setReading] = useState('')
  const session = useRef(0) // identifies the current reading so a stale "end" event is ignored
  const location = useLocation()
  const toast = useToast()

  const stop = useCallback(() => {
    session.current += 1
    synth()?.cancel()
    setReading('')
  }, [])

  const speak = useCallback(
    (title, text) => {
      if (!supported) return false
      synth().cancel()
      const mine = ++session.current
      const chunks = splitForSpeech(text)
      if (chunks.length === 0) {
        setReading('')
        return true
      }
      const voice = pickSpanishVoice()
      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        utterance.lang = voice?.lang || 'es-CO'
        if (voice) utterance.voice = voice
        utterance.rate = 0.95
        if (index === chunks.length - 1) {
          utterance.onend = () => {
            if (session.current === mine) setReading('')
          }
        }
        utterance.onerror = (event) => {
          const interrupted = event?.error === 'interrupted' || event?.error === 'canceled'
          if (session.current !== mine || interrupted) return
          session.current += 1 // ignore the errors of the remaining pieces
          synth()?.cancel()
          setReading('')
          toast('No se pudo leer en voz alta en este dispositivo.', 'info')
        }
        synth().speak(utterance)
      })
      setReading(title)
      return true
    },
    [supported, toast],
  )

  // A page change must not keep reading the previous page.
  useEffect(() => {
    stop()
  }, [location.pathname, stop])

  useEffect(() => () => synth()?.cancel(), [])

  const value = useMemo(() => ({ supported, reading, speak, stop }), [supported, reading, speak, stop])

  return (
    <SpeechContext.Provider value={value}>
      {children}
      {reading && (
        <div role="status" className="ag-reading">
          <Icon name="altavoz" size={20} />
          <span className="ag-reading__text">
            Leyendo en voz alta: <b>{reading}</b>
          </span>
          <button type="button" className="ag-reading__stop" onClick={stop}>
            Detener
          </button>
        </div>
      )}
    </SpeechContext.Provider>
  )
}

export function useSpeech() {
  return useContext(SpeechContext)
}
