import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Icon from '../components/ui/Icon.jsx'
import { isOnline } from '../offline/connectivity.js'
import { cacheDelete, cacheGet, cacheSet } from '../offline/store.js'
import { fetchVoice } from '../services/voice.js'
import { useToast } from './ToastContext.jsx'

/**
 * Voice guide (F9). The public content is read with the voice of the portal, the same for everybody: audio made by the server,
 * kept on this device once heard so it also plays with no signal. Everything else, or when that audio cannot be had, is read
 * with the browser's speech synthesis, in Spanish. The "Leyendo en voz alta" bar shows what is being read and stops it.
 */

const SpeechContext = createContext({
  supported: false,
  reading: '',
  speak: () => false,
  stop: () => {},
})

const MAX_CHUNK = 160 // short pieces: some browsers cut long ones off, and the breath between them sounds less like a machine
const SAVED_INDEX = 'voz:guardadas' // which audios this device keeps, oldest first
const MAX_SAVED = 12 // about 1 MB each at most: enough for what a person listens to, without filling a phone
// A moment of silence. Phones only let a page play sound during a tap; playing this during it lets the real audio start later.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

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

/** The audio this device kept of a piece, as an address the player can open; or null. */
async function savedAudio(piece) {
  const saved = await cacheGet(`voz:${piece}`)
  if (!saved?.bytes) return null
  return URL.createObjectURL(new Blob([saved.bytes], { type: saved.type }))
}

/** Keeps the audio on the device, for when there is no signal. If it cannot be kept, nothing is lost: it only needs signal next time. */
async function keepAudio(piece, url) {
  try {
    const key = `voz:${piece}`
    if ((await cacheGet(key))?.url === url) return
    const response = await fetch(url)
    if (!response.ok) return
    await cacheSet(key, { url, bytes: await response.arrayBuffer(), type: response.headers.get('Content-Type') || 'audio/mpeg' })
    const kept = [...((await cacheGet(SAVED_INDEX)) ?? []).filter((item) => item !== key), key]
    await Promise.all(kept.slice(0, -MAX_SAVED).map((old) => cacheDelete(old)))
    await cacheSet(SAVED_INDEX, kept.slice(-MAX_SAVED))
  } catch {
    /* the file store does not let this be read, or the phone has no room */
  }
}

export function SpeechProvider({ children }) {
  const supported = Boolean(synth()) && typeof SpeechSynthesisUtterance !== 'undefined'
  const [reading, setReading] = useState('')
  const [preparing, setPreparing] = useState(false) // the server is making the audio: it takes a moment the first time
  const player = useRef(null)
  const session = useRef(0) // identifies the current reading so a stale "end" event is ignored
  const location = useLocation()
  const toast = useToast()

  const stop = useCallback(() => {
    session.current += 1
    synth()?.cancel()
    player.current?.pause()
    setReading('')
    setPreparing(false)
  }, [])

  const speakWithDevice = useCallback(
    (text, mine) => {
      if (!supported) {
        setReading('')
        return false
      }
      const chunks = splitForSpeech(prepareForSpeech(text))
      if (chunks.length === 0) {
        setReading('')
        return true
      }
      const voice = spanishVoices(synth()?.getVoices?.() ?? [])[0] // the list comes the most human first
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
      return true
    },
    [supported, toast],
  )

  /** The voice of the portal: with signal the server says where the audio is; without it, what this device kept. Else, the device reads. */
  const speakWithPortalVoice = useCallback(
    async (piece, text, mine) => {
      const audio = player.current
      let source = null
      let url = null
      if (isOnline()) {
        try {
          url = (await fetchVoice(piece)).url
          source = url
        } catch {
          /* the service is down or used up for today: what the device kept, or its own voice */
        }
      }
      if (session.current !== mine) return
      if (!source) source = await savedAudio(piece)
      if (session.current !== mine) return
      setPreparing(false)
      try {
        if (!source) throw new Error('no audio')
        audio.onended = () => {
          if (session.current === mine) setReading('')
        }
        audio.onerror = null
        audio.src = source
        await audio.play()
        if (url) keepAudio(piece, url)
      } catch {
        if (session.current !== mine) return
        if (!speakWithDevice(text, mine)) toast('Este dispositivo no puede leer en voz alta.', 'info')
      }
    },
    [speakWithDevice, toast],
  )

  const speak = useCallback(
    (title, text, piece) => {
      if (!supported && !piece) return false
      synth()?.cancel()
      player.current?.pause()
      const mine = ++session.current
      setPreparing(false)
      if (piece) {
        player.current ??= new Audio()
        player.current.src = SILENCE
        player.current.play()?.catch?.(() => {}) // during the tap, or the phone would not let the audio start after the wait
        setReading(title)
        setPreparing(true)
        speakWithPortalVoice(piece, text, mine)
        return true
      }
      setReading(title)
      return speakWithDevice(text, mine)
    },
    [supported, speakWithDevice, speakWithPortalVoice],
  )

  // A page change must not keep reading the previous page.
  useEffect(() => {
    stop()
  }, [location.pathname, stop])

  useEffect(
    () => () => {
      synth()?.cancel()
      player.current?.pause()
    },
    [],
  )

  const value = useMemo(() => ({ supported, reading, speak, stop }), [supported, reading, speak, stop])

  return (
    <SpeechContext.Provider value={value}>
      {children}
      {reading && (
        <div role="status" className="ag-reading">
          <Icon name="altavoz" size={20} />
          <span className="ag-reading__text">
            {preparing ? 'Preparando la voz' : 'Leyendo en voz alta'}: <b>{reading}</b>
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
