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

const MAX_CHUNK = 160 // short pieces: some browsers cut long ones off, and the breath between them sounds less like a machine
const VOICE_KEY = 'agrocultura.voz' // the voice the person chose, on this device

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

/** Written signs a voice stumbles on: it should say "5775 metros", not "cinco punto siete... eme", or read a "·" aloud. */
export function prepareForSpeech(text) {
  return text
    .replace(/(\d)\.(?=\d{3}\b)/g, '$1')
    .replace(/(\d)\s?km\b/g, '$1 kilómetros')
    .replace(/(\d)\s?m\b/g, '$1 metros')
    .replace(/\s·\s/g, ', ')
    .replace(/[«»#]/g, '')
}

/** Voices made as a joke or an imitation of old machines: every device has several, and they used to be picked by accident. */
const MACHINE_VOICES = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|eloquence|compact|espeak)\b/i

/** How human a voice tends to sound. The name says it: the neural voices of the browsers and the phones are the best ones. */
export function voiceScore(voice) {
  const lang = voice.lang?.toLowerCase().replace('_', '-') ?? ''
  if (!lang.startsWith('es')) return -Infinity
  const name = voice.name ?? ''
  let score = 0
  if (/natural|neural/i.test(name)) score += 100
  else if (/premium|enhanced|mejorada/i.test(name)) score += 90
  else if (/siri/i.test(name)) score += 70
  else if (/google/i.test(name)) score += 60
  else if (/paulina|m[oó]nica|helena|laura|sabina|raul|dalia|jorge|juan|angelica/i.test(name)) score += 30
  if (MACHINE_VOICES.test(name)) score -= 200
  if (lang.startsWith('es-co')) score += 20
  else if (/^es-(mx|us|419|ve|pe|ar|cl)/.test(lang)) score += 12
  return score
}

/** The Spanish voices of this device, the most human first. */
export function spanishVoices(voices) {
  return voices
    .filter((voice) => voiceScore(voice) > -Infinity)
    .sort((a, b) => voiceScore(b) - voiceScore(a))
}

function readStoredVoice() {
  try {
    return localStorage.getItem(VOICE_KEY)
  } catch {
    return null // storage can be blocked (private mode)
  }
}

function storeVoice(name) {
  try {
    localStorage.setItem(VOICE_KEY, name)
  } catch {
    /* it still applies to this visit */
  }
}

/** Only the voices worth offering; the machine ones stay out as long as there is any other. */
function offeredVoices() {
  const all = spanishVoices(synth()?.getVoices?.() ?? [])
  const human = all.filter((voice) => !MACHINE_VOICES.test(voice.name ?? ''))
  return (human.length > 0 ? human : all).slice(0, 8)
}

export function SpeechProvider({ children }) {
  const supported = Boolean(synth()) && typeof SpeechSynthesisUtterance !== 'undefined'
  const [reading, setReading] = useState('')
  const [voices, setVoices] = useState([])
  const [voiceName, setVoiceName] = useState(readStoredVoice)
  const current = useRef(null) // what is being read, to start over when the person picks another voice
  const session = useRef(0) // identifies the current reading so a stale "end" event is ignored
  const location = useLocation()
  const toast = useToast()

  const stop = useCallback(() => {
    session.current += 1
    synth()?.cancel()
    setReading('')
  }, [])

  // Browsers load their voices late: the list is empty on the first call, and the best ones arrive afterwards.
  useEffect(() => {
    const engine = synth()
    if (!engine) return undefined
    const load = () => setVoices(offeredVoices())
    load()
    engine.addEventListener?.('voiceschanged', load)
    return () => engine.removeEventListener?.('voiceschanged', load)
  }, [])

  const speak = useCallback(
    (title, text, chosenName = voiceName) => {
      if (!supported) return false
      synth().cancel()
      const mine = ++session.current
      current.current = { title, text }
      const chunks = splitForSpeech(prepareForSpeech(text))
      if (chunks.length === 0) {
        setReading('')
        return true
      }
      const offered = offeredVoices()
      setVoices(offered)
      const voice = offered.find((item) => item.name === chosenName) ?? offered[0]
      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        utterance.lang = voice?.lang || 'es-CO'
        if (voice) utterance.voice = voice
        utterance.rate = 0.96
        utterance.pitch = 1
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
    [supported, toast, voiceName],
  )

  const chooseVoice = (name) => {
    setVoiceName(name)
    storeVoice(name)
    if (current.current) speak(current.current.title, current.current.text, name)
  }

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
          {voices.length > 1 && (
            <label className="ag-reading__voice">
              Voz
              <select value={voices.some((item) => item.name === voiceName) ? voiceName : voices[0].name} onChange={(event) => chooseVoice(event.target.value)}>
                {voices.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
