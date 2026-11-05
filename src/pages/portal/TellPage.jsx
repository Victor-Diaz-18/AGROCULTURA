import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Icon from '../../components/ui/Icon.jsx'
import pages from '../../../lib/voice/paginas.json'
import ListenButton from '../../components/ui/ListenButton.jsx'
import Stepper from '../../components/tell/Stepper.jsx'
import StepRecord from '../../components/tell/StepRecord.jsx'
import StepReview from '../../components/tell/StepReview.jsx'
import StepWhereWhen from '../../components/tell/StepWhereWhen.jsx'
import { DEFAULT_TAG, LIMITS, NARRADOR_ANONIMO, NO_LOCATION } from '../../config/constants.js'
import { codeNote } from '../../config/flags.js'
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
import { acceptConsent, consentText, consentVariant, isAccepted } from '../../utils/consent.js'
import { newId } from '../../utils/id.js'
import { placeLine } from '../../utils/geo.js'

const SUBTITLE = 'Con tu voz, una foto, un video o por escrito. Nadie la ve hasta que un administrador la aprueba.'

/** What "Escuchar instrucciones" reads on each step (F9). The last one also reads the authorization, so it can be heard before it is given. */
/** The words live in lib/voice/paginas.json, because the server reads them aloud too. Never what the person is writing. */
const READ_ALOUD = {
  1: pages['contar-1'],
  2: pages['contar-2'],
  3: (consent) => pages['contar-3'].replace('{texto}', consent.texto).replace('{aviso}', consent.aviso ?? ''),
}

export const SEND_MESSAGES = {
  done: 'Enviada. Un administrador la revisará antes de publicarla.',
  doneWithVideo: 'Enviada. Estamos subiendo el video; un administrador la revisará antes de publicarla.',
  videoNotKept: 'Enviada, pero no pudimos guardar el video para subirlo. Avisa al equipo para que lo agreguen.',
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
  !draft.finca.trim() &&
  !draft.audio &&
  !draft.video &&
  !draft.location &&
  !draft.epoca &&
  draft.fotos.length === 0 &&
  draft.etiquetas.length === 0

/** The formats of a story as "Mis historias" lists them (the same words the server uses). */
const formatLabels = (audio, fotos, video) => {
  const labels = []
  if (audio) labels.push('Audio')
  if (fotos.length > 0) labels.push('Foto')
  if (video) labels.push('Video')
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
  const { enqueue, enqueueVideo, persistent } = useOutbox()
  const { online } = useConnectivity()
  const narratorId = user?.id ?? null

  const [step, setStep] = useState(1)
  const [texto, setTexto] = useState('')
  const [audio, setAudio] = useState(null)
  const [fotos, setFotos] = useState([])
  const [video, setVideo] = useState(null) // { id, name, blob, mime }: one at most; it goes up after the story
  const [titulo, setTitulo] = useState('')
  const [location, setLocation] = useState(null)
  const [modo, setModo] = useState('aproximada') // "aproximada": a point on the map (about 500 m for the public); "ninguna": no place on the map
  const [lugar, setLugar] = useState('')
  const [finca, setFinca] = useState('')
  const [anonima, setAnonima] = useState(false) // "publicar sin mi nombre"
  const [consent, setConsent] = useState(null) // what was kept when the authorization was ticked (see utils/consent.js)
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
  const draft = {
    clientId,
    step,
    texto,
    titulo,
    location,
    ubicacionModo: modo,
    lugar,
    finca,
    anonima,
    consentimiento: consent,
    epoca,
    etiquetas,
    audio,
    fotos,
    video,
    photoNumber: photoNumber.current,
  }
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
          setVideo(found.video ?? null)
          setTitulo(found.titulo)
          setLocation(found.location)
          setModo(found.ubicacionModo ?? 'aproximada') // a story left half told before these options existed has a point
          setLugar(found.lugar)
          setFinca(found.finca ?? '')
          setAnonima(Boolean(found.anonima))
          setConsent(found.consentimiento ?? null)
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
  }, [saved, keepDraft, clientId, texto, titulo, location, modo, lugar, finca, anonima, consent, epoca, etiquetas, audio, fotos, video])

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
  // The authorization was given for one text (name or not, place or not): it only counts while the choices are the same.
  const choice = { anonima, modo }
  const accepted = isAccepted(consent, choice)
  const authorization = consentText(choice)
  const authorizationVariant = consentVariant(choice)
  const placed = modo === 'ninguna' || Boolean(location) // without a place on the map there is no point to wait for
  const canContinue = {
    1: Boolean(audio) || recording || texto.trim().length > 0,
    2: titulo.trim().length >= LIMITS.tituloMin && placed && Boolean(epoca),
    3: !sending && accepted, // without signal the story is kept on the phone; without the authorization it goes nowhere
  }[step]

  const help = {
    1: canContinue ? 'Puedes agregar fotos o un video si los tienes.' : 'Graba un audio o escribe la historia para seguir.',
    2: canContinue ? 'Todo listo para revisar.' : 'Falta el título, el lugar o la época.',
    3: !accepted
      ? 'Marca la autorización para poder enviarla.'
      : online
        ? `Al enviarla pasa a revisión${codeNote('F6')}.`
        : 'Sin señal: quedará como borrador.',
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
    video,
    onAddVideo: setVideo,
    onRemoveVideo: () => setVideo(null),
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
    setVideo(null)
    setTitulo('')
    setLocation(null)
    setModo('aproximada')
    setLugar('')
    setFinca('')
    setAnonima(false)
    setConsent(null)
    setEpoca('')
    setEtiquetas([])
    setSendError('')
    setRecovered(false)
  }

  const sentTags = etiquetas.length > 0 ? etiquetas : [DEFAULT_TAG]
  const formats = []
  if (audio) formats.push(`Audio ${formatDuration(audio.seconds)}`)
  if (fotos.length > 0) formats.push(fotos.length === 1 ? '1 foto' : `${fotos.length} fotos`)
  if (video) formats.push('Video')
  const summary = {
    titulo: titulo.trim() || 'Sin título todavía',
    // Without a place on the map the name of reference is not said: it is not public, and the page may be read aloud or shown to others.
    lugar: modo === 'ninguna' ? NO_LOCATION : location ? placeLine({ sector_id: location.sectorId, lugar_nombre: lugar.trim() }, config.sectores) : 'Sin elegir',
    epoca: epoca || 'Sin elegir',
    narrador: anonima ? NARRADOR_ANONIMO : (user?.nombre ?? ''),
    finca: finca.trim(),
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
    ubicacionModo: modo,
    lugar: lugar.trim(),
    finca: finca.trim(),
    anonima,
    consentimiento: accepted ? consent : null,
    etiquetas: sentTags,
    audio,
    fotos,
    video,
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
      await enqueue({ ...story(), formatos: formatLabels(audio, fotos, video), lugarTexto: summary.lugar, subidos })
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
    if (!accepted) return // nothing leaves without the authorization (the button is disabled; this is for the keyboard and for tests)
    setSending(true)
    setSendError('')
    if (!online) {
      await keepOnDevice()
      return
    }
    let sent
    try {
      sent = await sendStory(story(), { uploaded: uploaded.current })
    } catch (error) {
      if (error instanceof OfflineError) {
        await keepOnDevice() // the signal went away while sending
        return
      }
      if (error instanceof ApiError && error.status === 401) openLogin({ rol: 'narrador' })
      setSendError(describeFailure(error))
      setSending(false)
      return
    }
    // The story is in. Its video goes after it, on its own (it can take long over a bad connection): the story never waits.
    let message = video ? SEND_MESSAGES.doneWithVideo : SEND_MESSAGES.done
    if (video) {
      try {
        await enqueueVideo({ clientId, codigo: sent.codigo, titulo: titulo.trim(), video })
      } catch {
        message = SEND_MESSAGES.videoNotKept
      }
    }
    finished.current = true
    clearWorkingDraft(narratorId).catch(() => {})
    toast(message)
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
        actions={
          <ListenButton
            title="Contar una historia"
            text={() => (step === 3 ? READ_ALOUD[3](authorization) : READ_ALOUD[step])}
            piece={`paginas/contar-${step === 3 ? `3-${authorizationVariant}` : step}`}
            label="Escuchar instrucciones"
          />
        }
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
              modo={modo}
              onModo={setModo}
              location={location}
              onLocation={setLocation}
              lugar={lugar}
              onLugar={setLugar}
              finca={finca}
              onFinca={setFinca}
              epoca={epoca}
              onEpoca={setEpoca}
              etiquetas={etiquetas}
              onToggleTag={toggleTag}
            />
          )}
          {step === 3 && (
            <StepReview
              summary={summary}
              online={online}
              sendError={sendError}
              anonima={anonima}
              onAnonima={setAnonima}
              consent={authorization}
              accepted={accepted}
              onAccept={(checked) => setConsent(checked ? acceptConsent(choice) : null)}
            />
          )}

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
