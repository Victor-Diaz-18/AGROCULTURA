import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Icon from '../../components/ui/Icon.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'
import Stepper from '../../components/tell/Stepper.jsx'
import StepRecord from '../../components/tell/StepRecord.jsx'
import StepReview from '../../components/tell/StepReview.jsx'
import StepWhereWhen from '../../components/tell/StepWhereWhen.jsx'
import { DEFAULT_TAG, LIMITS } from '../../config/constants.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useMyStories } from '../../context/MyStoriesContext.jsx'
import { useOutbox } from '../../context/OutboxContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import useConnectivity from '../../hooks/useConnectivity.js'
import useRecorder from '../../hooks/useRecorder.js'
import { clearWorkingDraft, loadWorkingDraft, saveWorkingDraft } from '../../offline/store.js'
import { ApiError, OfflineError } from '../../services/http.js'
import { sendStory } from '../../services/stories.js'
import { formatDuration } from '../../utils/format.js'
import { newId } from '../../utils/id.js'
import { placeLine } from '../../utils/geo.js'

const SUBTITLE = 'Con tu voz, una foto, un video o por escrito. Nadie la ve hasta que un administrador la aprueba.'

/** What "Escuchar instrucciones" reads on each step (F9). */
const READ_ALOUD = {
  1: 'Contar una historia. Paso 1 de 3: cuéntala. Toca el botón rojo para grabarla con tu voz, o escríbela. Si tienes fotos, puedes agregarlas.',
  2: 'Contar una historia. Paso 2 de 3: dónde y cuándo. Ponle un título, toca en el mapa el sector donde ocurrió y elige la época.',
  3: 'Contar una historia. Paso 3 de 3: revisa tu historia y tócala enviar. Un administrador la revisa antes de publicarla.',
}

export const SEND_MESSAGES = {
  done: 'Enviada. Un administrador la revisará antes de publicarla.',
  queued: 'Sin señal: quedó como borrador en el dispositivo.',
  queuedLoose: 'Sin señal: quedó como borrador, pero solo mientras no cierres esta página.',
  notSaved: 'No pudimos guardar tu historia en el dispositivo. Tu historia sigue aquí: intenta de nuevo.',
  expired: 'Tu sesión venció. Ingresa de nuevo y toca «Enviar historia»: tu historia sigue aquí.',
  failed: 'No pudimos enviar tu historia. Intenta de nuevo en un momento.',
}

/** How long the form waits after the last change before saving it on the phone. */
export const SAVE_DELAY_MS = 600

const isBlank = (draft) =>
  !draft.texto.trim() &&
  !draft.titulo.trim() &&
  !draft.lugar.trim() &&
  !draft.audio &&
  !draft.location &&
  !draft.epoca &&
  draft.fotos.length === 0 &&
  draft.etiquetas.length === 0

/** The formats of a story as "Mis historias" lists them (the same words the server uses). */
const formatLabels = (audio, fotos) => {
  const labels = []
  if (audio) labels.push('Audio')
  if (fotos.length > 0) labels.push('Foto')
  return labels.length > 0 ? labels : ['Texto']
}

function describeFailure(error) {
  if (error instanceof ApiError && error.status === 401) return SEND_MESSAGES.expired
  if (error instanceof ApiError) return error.message
  return SEND_MESSAGES.failed
}

/** Tell a story in three steps: tell it, where and when, review and send (F3, F4, F5, F1, F10). */
export default function TellPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, openLogin } = useAuth()
  const { config, reload } = usePortalData()
  const { reload: reloadMine } = useMyStories()
  const { enqueue, persistent } = useOutbox()
  const { online } = useConnectivity()
  const narratorId = user?.id ?? null

  const [step, setStep] = useState(1)
  const [texto, setTexto] = useState('')
  const [audio, setAudio] = useState(null)
  const [fotos, setFotos] = useState([])
  const [titulo, setTitulo] = useState('')
  const [location, setLocation] = useState(null)
  const [lugar, setLugar] = useState('')
  const [epoca, setEpoca] = useState('')
  const [etiquetas, setEtiquetas] = useState([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [clientId, setClientId] = useState(newId) // the same story keeps this id, so resending never duplicates it
  const [saved, setSaved] = useState(false) // the phone has been asked for what it kept of this story
  const [recovered, setRecovered] = useState(false) // ...and it had something

  const uploaded = useRef(new WeakMap()) // files that already went up: a retry does not upload them again
  const photoNumber = useRef(1)
  const stepper = useRef(null)
  const firstRender = useRef(true)
  const finished = useRef(false) // the story left (sent or kept in the queue): nothing more to save as a draft

  const recorder = useRecorder({ onRecorded: ({ blob, seconds, mime }) => setAudio({ blob, seconds, mime }) })

  // Everything the person has put in so far: what is kept on the phone while they tell it (F10).
  const draft = { clientId, step, texto, titulo, location, lugar, epoca, etiquetas, audio, fotos, photoNumber: photoNumber.current }
  const latest = useRef(draft)
  latest.current = draft
  const savedRef = useRef(false)
  savedRef.current = saved

  // Pick up the story the person left half told on this phone.
  useEffect(() => {
    if (!narratorId) return undefined
    let cancelled = false
    loadWorkingDraft(narratorId)
      .catch(() => null)
      .then((found) => {
        if (cancelled) return
        if (found && isBlank(latest.current)) {
          setClientId(found.clientId)
          setStep(found.step)
          setTexto(found.texto)
          setAudio(found.audio)
          setFotos(found.fotos)
          setTitulo(found.titulo)
          setLocation(found.location)
          setLugar(found.lugar)
          setEpoca(found.epoca)
          setEtiquetas(found.etiquetas)
          photoNumber.current = found.photoNumber ?? found.fotos.length + 1
          setRecovered(true)
        }
        setSaved(true)
      })
    return () => {
      cancelled = true
    }
  }, [narratorId])

  const keepDraft = useCallback(() => {
    if (!narratorId || !savedRef.current || finished.current) return
    const current = latest.current
    const done = isBlank(current) ? clearWorkingDraft(narratorId) : saveWorkingDraft(narratorId, current)
    done.catch(() => {}) // without room on the phone the story still works, it is only not kept
  }, [narratorId])

  // Typing is saved when the person pauses; moving to another step (a deliberate act) is saved at once.
  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(keepDraft, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [saved, keepDraft, clientId, texto, titulo, location, lugar, epoca, etiquetas, audio, fotos])

  useEffect(() => {
    if (saved) keepDraft()
  }, [saved, step, keepDraft])

  // Leaving the page, reloading it or switching to another app must not lose the last words.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') keepDraft()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', keepDraft)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', keepDraft)
      keepDraft()
    }
  }, [keepDraft])

  // On a phone the buttons sit at the bottom of a long step: show the new one from its top.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const steps = stepper.current
    if (steps && steps.getBoundingClientRect().top < 0) steps.scrollIntoView?.({ block: 'start' })
  }, [step])

  const recording = recorder.status === 'recording'
  const canContinue = {
    1: Boolean(audio) || recording || texto.trim().length > 0,
    2: titulo.trim().length >= LIMITS.tituloMin && Boolean(location) && Boolean(epoca),
    3: !sending, // without signal the story is kept on the phone
  }[step]

  const help = {
    1: canContinue ? 'Puedes agregar fotos si las tienes.' : 'Graba un audio o escribe la historia para seguir.',
    2: canContinue ? 'Todo listo para revisar.' : 'Falta el título, el sector o la época.',
    3: online ? 'Al enviarla pasa a revisión (F6).' : 'Sin señal: quedará como borrador.',
  }[step]

  const startRecording = () => recorder.start()
  const toggleTag = (tag) =>
    setEtiquetas((current) => {
      if (current.includes(tag)) return current.filter((item) => item !== tag)
      return current.length >= LIMITS.etiquetas ? current : [...current, tag]
    })

  const photos = {
    photos: fotos,
    nextName: () => `foto_${String(photoNumber.current++).padStart(2, '0')}.jpg`,
    onAdd: (added) => setFotos((current) => [...current, ...added]),
    onRemove: (id) => setFotos((current) => current.filter((photo) => photo.id !== id)),
  }

  const startOver = () => {
    finished.current = false
    clearWorkingDraft(narratorId).catch(() => {})
    uploaded.current = new WeakMap()
    photoNumber.current = 1
    setClientId(newId())
    setStep(1)
    setTexto('')
    setAudio(null)
    setFotos([])
    setTitulo('')
    setLocation(null)
    setLugar('')
    setEpoca('')
    setEtiquetas([])
    setSendError('')
    setRecovered(false)
  }

  const sentTags = etiquetas.length > 0 ? etiquetas : [DEFAULT_TAG]
  const formats = []
  if (audio) formats.push(`Audio ${formatDuration(audio.seconds)}`)
  if (fotos.length > 0) formats.push(fotos.length === 1 ? '1 foto' : `${fotos.length} fotos`)
  const summary = {
    titulo: titulo.trim() || 'Sin título todavía',
    lugar: location ? placeLine({ sector_id: location.sectorId, lugar_nombre: lugar.trim() }, config.sectores) : 'Sin elegir',
    epoca: epoca || 'Sin elegir',
    narrador: user?.nombre ?? '',
    texto:
      texto.trim() ||
      (audio ? 'Historia contada en audio. La transcripción se agrega después.' : 'Todavía no has grabado ni escrito la historia.'),
    formatos: formats.length > 0 ? formats : ['Texto'],
    formatosTexto: formats.length > 0 ? formats.join(' · ') : texto.trim() ? 'Texto' : 'Ninguno todavía',
    etiquetas: sentTags,
  }

  const story = () => ({
    clientId,
    titulo: titulo.trim(),
    texto: texto.trim(),
    epoca,
    location,
    lugar: lugar.trim(),
    etiquetas: sentTags,
    audio,
    fotos,
  })

  /** No signal: the finished story stays on the phone and goes out by itself when the signal returns. */
  const keepOnDevice = async () => {
    // What already went up in a send that was cut off is remembered, so it is not uploaded again.
    const subidos = {}
    const audioMedio = audio && uploaded.current.get(audio.blob)
    if (audioMedio) subidos.audio = audioMedio
    for (const photo of fotos) {
      const medio = uploaded.current.get(photo.blob)
      if (medio) subidos[photo.id] = medio
    }
    try {
      await enqueue({ ...story(), formatos: formatLabels(audio, fotos), lugarTexto: summary.lugar, subidos })
    } catch {
      setSendError(SEND_MESSAGES.notSaved)
      setSending(false)
      return
    }
    finished.current = true
    clearWorkingDraft(narratorId).catch(() => {})
    toast(persistent ? SEND_MESSAGES.queued : SEND_MESSAGES.queuedLoose, 'info')
    navigate('/mis-historias')
  }

  const send = async () => {
    setSending(true)
    setSendError('')
    if (!online) {
      await keepOnDevice()
      return
    }
    try {
      await sendStory(story(), { uploaded: uploaded.current })
    } catch (error) {
      if (error instanceof OfflineError) {
        await keepOnDevice() // the signal went away while sending
        return
      }
      if (error instanceof ApiError && error.status === 401) openLogin({ tab: 'narrador' })
      setSendError(describeFailure(error))
      setSending(false)
      return
    }
    finished.current = true
    clearWorkingDraft(narratorId).catch(() => {})
    toast(SEND_MESSAGES.done)
    reload() // the public counters change when a story enters review
    reloadMine()
    navigate('/mis-historias')
  }

  const next = () => {
    if (step === 1) {
      if (recording) recorder.stop() // the audio is kept as soon as the recorder finishes
      setStep(2)
    } else if (step === 2) setStep(3)
    else send()
  }

  const nextLabel = step < 3 ? 'Siguiente' : sending ? 'Enviando…' : online ? 'Enviar historia' : 'Guardar en el dispositivo'

  return (
    <>
      <PageHeader
        title="Contar una historia"
        subtitle={SUBTITLE}
        actions={<ListenButton title="Contar una historia" text={() => READ_ALOUD[step]} label="Escuchar instrucciones" />}
      />
      <Stepper ref={stepper} current={step} />

      <div className="ag-tell">
        <div className="ag-tell__card">
          {recovered && !recording && (
            <p role="status" className="ag-hint ag-tell__recovered">
              Recuperamos la historia que dejaste a medias.{' '}
              <button type="button" className="ag-linkbutton" onClick={startOver}>
                Empezar de nuevo
              </button>
            </p>
          )}
          {step === 1 && (
            <StepRecord
              recorder={recorder}
              audio={audio}
              onStartRecording={startRecording}
              onRemoveAudio={() => setAudio(null)}
              texto={texto}
              onTexto={setTexto}
              photos={photos}
              onDevice={persistent}
            />
          )}
          {step === 2 && (
            <StepWhereWhen
              config={config}
              titulo={titulo}
              onTitulo={setTitulo}
              location={location}
              onLocation={setLocation}
              lugar={lugar}
              onLugar={setLugar}
              epoca={epoca}
              onEpoca={setEpoca}
              etiquetas={etiquetas}
              onToggleTag={toggleTag}
            />
          )}
          {step === 3 && <StepReview summary={summary} online={online} sendError={sendError} />}

          <div className="ag-tell__footer">
            <span className="ag-tell__help">{help}</span>
            <div className="ag-tell__buttons">
              {step > 1 && (
                <button type="button" className="ag-tell__back" onClick={() => setStep(step - 1)} disabled={sending}>
                  Atrás
                </button>
              )}
              <button
                type="button"
                className={`ag-tell__next${step === 3 ? ' ag-tell__next--send' : ''}`}
                onClick={next}
                disabled={!canContinue}
              >
                {nextLabel}
              </button>
            </div>
          </div>
        </div>

        <aside className="ag-tell__aside" aria-label="Resumen de tu historia">
          <div className="ag-sidecard">
            <span className="ag-sidecard__kicker">ASÍ VA TU HISTORIA</span>
            <span className="ag-sidecard__title">{summary.titulo}</span>
            <div className="ag-sidecard__list">
              <span>
                Lugar: <b>{summary.lugar}</b>
              </span>
              <span>
                Época: <b>{summary.epoca}</b>
              </span>
              <span>
                Formatos: <b>{summary.formatosTexto}</b>
              </span>
            </div>
          </div>
          <div className={`ag-signal ag-signal--aside${online ? '' : ' ag-signal--off'}`}>
            <Icon name="wifi-off" size={22} />
            <p>
              {persistent
                ? 'Todo se guarda en el dispositivo mientras la cuentas. Si no hay señal al final, queda como borrador y se envía sola después.'
                : 'Tu teléfono no deja guardar en el dispositivo: lo que cuentas se queda en esta página mientras no la cierres. Para enviarla al final necesitas señal.'}
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
