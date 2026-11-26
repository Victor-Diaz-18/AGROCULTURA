import { useRef, useState } from 'react'
import { LIMITS, MAX_FARM_NAME, MAX_PLACE_NAME, MAX_UPLOAD_BYTES } from '../../config/constants.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ApiError, OfflineError } from '../../services/http.js'
import { publishProjectStory } from '../../services/admin.js'
import { readAudioDuration } from '../../utils/audio.js'
import { acceptConsent, consentText, isAccepted } from '../../utils/consent.js'
import { formatBytes, formatDuration } from '../../utils/format.js'
import { newId } from '../../utils/id.js'
import LocationPicker from '../map/LocationPicker.jsx'
import MediaPicker from '../tell/MediaPicker.jsx'
import PlaceOptions from '../tell/PlaceOptions.jsx'
import Chip from '../ui/Chip.jsx'
import FCode from '../ui/FCode.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import YearsField from '../tell/YearsField.jsx'
import { checkYears, parseYear } from '../../utils/years.js'

/**
 * "Nueva historia del proyecto" (F12): a story the team uploads; it is published at once.
 * Photos are reduced like the narrators' (MediaPicker); the audio is a file the team already has; the video (up to 25 MB)
 * goes straight to Blob.
 */

export const AUDIO_MESSAGES = {
  tooBig: `Ese audio pesa más de ${formatBytes(MAX_UPLOAD_BYTES)}, que es lo máximo por ahora. Comprímelo o usa un fragmento más corto.`,
}

/** What a team story being edited already has, in the shape the form uses (its files are addresses: they are not uploaded again). */
function startingPoint(story) {
  if (!story) return null
  const medios = story.medios ?? []
  const named = (tipo, number) => `${tipo}_${String(number).padStart(2, '0')}`
  const audioMedio = medios.find((medio) => medio.tipo === 'audio' && medio.url)
  const videoMedio = medios.find((medio) => medio.tipo === 'video' && medio.url)
  const written = /^\d{4}( a \d{4})?$/.test(story.epoca ?? '') && story.anio_desde != null // years, not a period of before
  return {
    location: story.lat != null && story.lon != null ? { lat: story.lat, lon: story.lon, origen: story.ubicacion_origen ?? 'mapa', sectorId: story.sector_id } : null,
    anioDesde: written ? String(story.anio_desde) : '',
    anioHasta: written && story.anio_hasta !== story.anio_desde ? String(story.anio_hasta) : '',
    fotos: medios
      .filter((medio) => medio.tipo === 'foto' && medio.url)
      .map((medio, index) => ({ id: newId(), name: named('foto', index + 1), url: medio.url, bytes: medio.bytes, medio })),
    video: videoMedio ? { id: newId(), name: named('video', 1), url: videoMedio.url, bytes: videoMedio.bytes, mime: videoMedio.mime, medio: videoMedio } : null,
    audio: audioMedio ? { name: named('audio', 1), url: audioMedio.url, bytes: audioMedio.bytes, seconds: audioMedio.duracion_s, medio: audioMedio } : null,
  }
}

/** `story`: a team story to edit (as the list has it). Without it, a new one. */
export default function ProjectStoryModal({ story: editing = null, onClose, onPublished }) {
  const { config, reload } = usePortalData()
  const { user } = useAuth()
  const toast = useToast()
  const [start] = useState(() => startingPoint(editing))
  const [titulo, setTitulo] = useState(editing?.titulo ?? '')
  const [location, setLocation] = useState(start?.location ?? null) // { lat, lon, origen, sectorId }: anywhere in the zone
  const [modo, setModo] = useState(editing?.ubicacion_modo ?? 'aproximada') // "aproximada" (a point, about 500 m for the public) or "ninguna" (no place on the map)
  const [lugar, setLugar] = useState(editing?.lugar_nombre ?? '')
  const [finca, setFinca] = useState(editing?.finca_nombre ?? '')
  const [anonima, setAnonima] = useState(Boolean(editing?.anonima)) // publish without the name of whoever tells it
  const [consent, setConsent] = useState(null) // the team's confirmation that it has the authorization of whoever tells the story
  const [anioDesde, setAnioDesde] = useState(start?.anioDesde ?? '')
  const [anioHasta, setAnioHasta] = useState(start?.anioHasta ?? '')
  const [narrador, setNarrador] = useState(editing?.narrador_nombre ?? '')
  const [texto, setTexto] = useState(editing?.texto ?? '')
  const [etiquetas, setEtiquetas] = useState(editing?.etiquetas ?? [])
  const [fotos, setFotos] = useState(start?.fotos ?? [])
  const [video, setVideo] = useState(start?.video ?? null) // { id, name, blob, mime }: it goes straight to Blob
  const [progress, setProgress] = useState(null) // percent of the video that is going up
  const [audio, setAudio] = useState(start?.audio ?? null)
  const [audioProblem, setAudioProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [clientId] = useState(newId)
  const uploaded = useRef(new WeakMap())
  const photoNumber = useRef(1)
  const audioInput = useRef(null)

  // Neither the place nor the years have a default: a wrong one would go unnoticed.
  const yearsOk = anioDesde.trim() !== '' && checkYears(anioDesde, anioHasta) === ''

  // The authorization is for one text (with or without the name, with a place or none): it only counts while the choices are the same.
  const choice = { anonima, modo }
  const accepted = isAccepted(consent, choice)
  const authorization = consentText(choice, 'equipo')
  const placed = modo === 'ninguna' || Boolean(location)
  const valid = titulo.trim().length >= LIMITS.tituloMin && placed && yearsOk && (texto.trim().length > 0 || Boolean(audio)) && accepted

  const photos = {
    photos: fotos,
    nextName: () => `foto_${String(photoNumber.current++).padStart(2, '0')}.jpg`,
    onAdd: (added) => setFotos((current) => [...current, ...added]),
    onRemove: (id) => setFotos((current) => current.filter((photo) => photo.id !== id)),
    video,
    onAddVideo: setVideo,
    onRemoveVideo: () => setVideo(null),
  }

  const pickAudio = async (event) => {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setAudioProblem(AUDIO_MESSAGES.tooBig)
      return
    }
    setAudioProblem('')
    setAudio({ blob: file, name: file.name, seconds: null })
    // The length arrives a moment later (some files never tell it): the chip does not wait for it.
    readAudioDuration(file).then((seconds) =>
      setAudio((current) => (current?.blob === file ? { ...current, seconds } : current)),
    )
  }

  const toggleTag = (tag) =>
    setEtiquetas((current) => {
      if (current.includes(tag)) return current.filter((item) => item !== tag)
      return current.length >= LIMITS.etiquetas ? current : [...current, tag]
    })

  const publish = async () => {
    setBusy(true)
    setError('')
    setProgress(null)
    try {
      const story = await publishProjectStory(
        {
          ...(editing ? { codigo: editing.codigo } : {}),
          clientId,
          titulo: titulo.trim(),
          texto: texto.trim(),
          anioDesde: parseYear(anioDesde),
          anioHasta: parseYear(anioHasta) ?? parseYear(anioDesde),
          location,
          ubicacionModo: modo,
          lugar: lugar.trim(),
          finca: finca.trim(),
          anonima,
          consentimiento: accepted ? consent : null,
          etiquetas,
          narrador: narrador.trim(),
          audio,
          fotos,
          video,
        },
        { uploaded: uploaded.current, userId: user?.id, onProgress: setProgress },
      )
      const sector = config.sectores.find((item) => item.id === story.sector_id)
      if (editing) toast('Cambios guardados.')
      else toast(sector ? `Historia del proyecto publicada en ${sector.nombre}.` : 'Historia del proyecto publicada.')
      reload() // the counters change
      onPublished?.(story)
    } catch (failure) {
      setBusy(false)
      if (failure instanceof OfflineError) setError('Sin señal: no pudimos publicarla. Tus datos siguen aquí; inténtalo cuando vuelva la conexión.')
      else setError(failure instanceof ApiError ? failure.message : editing ? 'No pudimos guardar los cambios. Intenta de nuevo.' : 'No pudimos publicar la historia. Intenta de nuevo.')
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      label={editing ? 'Editar historia del proyecto' : 'Nueva historia del proyecto'}
      maxWidth={520}
      level={55}
      top={60}
      className="ag-project-modal"
    >
      <div className="ag-project-modal__head">
        <div>
          <h2 className="ag-project-modal__title">{editing ? 'Editar historia del proyecto' : 'Nueva historia del proyecto'}</h2>
          <span className="ag-project-modal__sub">
            {editing ? `${editing.codigo}. Los cambios se ven de una vez en el mapa.` : 'Se publica de una vez y se marca como «del proyecto».'}
          </span>
        </div>
        <button type="button" className="ag-close" aria-label="Cerrar" onClick={onClose} disabled={busy}>
          <Icon name="cerrar" size={16} strokeWidth={2.4} />
        </button>
      </div>

      <label className="ag-project-modal__field">
        Título
        <input
          type="text"
          className="ag-project-modal__input"
          value={titulo}
          maxLength={LIMITS.tituloMax}
          onChange={(event) => setTitulo(event.target.value)}
          placeholder="Título de la historia"
        />
      </label>

      <fieldset className="ag-project-modal__field ag-tell__where">
        <legend>¿Dónde ocurrió?</legend>
        <PlaceOptions modo={modo} onModo={setModo} />
        {modo === 'aproximada' && (
          <>
            <span>Toca el lugar en el mapa</span>
            <LocationPicker sectors={config.sectores} value={location} onChange={setLocation} />
            <span className="ag-hint">
              En el mapa público se ve un punto aproximado (a unos 500 metros). El punto exacto solo lo ven los administradores.
            </span>
          </>
        )}
      </fieldset>

      <div className="ag-project-modal__field">
        <label htmlFor="ag-proyecto-lugar">{modo === 'ninguna' ? 'Nombre de referencia (opcional)' : 'Nombre del lugar (opcional)'}</label>
        <input
          id="ag-proyecto-lugar"
          type="text"
          className="ag-project-modal__input"
          value={lugar}
          maxLength={MAX_PLACE_NAME}
          onChange={(event) => setLugar(event.target.value)}
          aria-describedby="ag-proyecto-lugar-ayuda"
          placeholder="Por ejemplo: Patio de secado de la finca"
        />
        <span id="ag-proyecto-lugar-ayuda" className="ag-hint">
          {modo === 'ninguna' ? 'Solo lo ve el equipo. El público no lo ve.' : 'Se verá en la ficha pública de la historia.'}
        </span>
      </div>

      <div className="ag-project-modal__field">
        <label htmlFor="ag-proyecto-finca">Nombre de la finca o marca (opcional)</label>
        <input
          id="ag-proyecto-finca"
          type="text"
          className="ag-project-modal__input"
          value={finca}
          maxLength={MAX_FARM_NAME}
          onChange={(event) => setFinca(event.target.value)}
          aria-describedby="ag-proyecto-finca-ayuda"
          placeholder="Por ejemplo: Café Don Aurelio"
        />
        <span id="ag-proyecto-finca-ayuda" className="ag-hint">
          Se verá en la ficha pública de la historia.{modo === 'ninguna' ? ' Piensa si el nombre de la finca dice dónde queda.' : ''}
        </span>
      </div>

      <YearsField id="ag-proyecto-anios" className="ag-project-modal__field" desde={anioDesde} hasta={anioHasta} onDesde={setAnioDesde} onHasta={setAnioHasta} />
      {editing && !start.anioDesde && (
        <p className="ag-hint">
          Tenía la época «{editing.epoca}». Escribe los años en que ocurrió para guardar los cambios.
        </p>
      )}

      <label className="ag-project-modal__field">
        Quién la cuenta
        <input
          type="text"
          className="ag-project-modal__input"
          value={narrador}
          maxLength={80}
          onChange={(event) => setNarrador(event.target.value)}
          placeholder="Equipo AGROCULTURA o nombre de la persona entrevistada"
        />
      </label>

      <label className="ag-option ag-option--check">
        <input type="checkbox" checked={anonima} onChange={(event) => setAnonima(event.target.checked)} aria-labelledby="ag-proyecto-anonima-titulo" aria-describedby="ag-proyecto-anonima-ayuda" />
        <span className="ag-option__body">
          <b id="ag-proyecto-anonima-titulo">Publicar sin el nombre de quien la cuenta</b>
          <span id="ag-proyecto-anonima-ayuda" className="ag-option__text">
            El público lee «Narrador anónimo». El equipo conserva el nombre.
          </span>
        </span>
      </label>

      <label className="ag-project-modal__field">
        Relato
        <textarea
          className="ag-project-modal__textarea"
          value={texto}
          maxLength={LIMITS.textoMax}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Qué pasó, quiénes estaban, por qué importa."
        />
      </label>

      <div className="ag-project-modal__field">
        <span>Etiquetas</span>
        <div className="ag-tell__chips">
          {config.etiquetas.map((tag) => (
            <Chip key={tag} size="sm" pressed={etiquetas.includes(tag)} onClick={() => toggleTag(tag)}>
              {tag}
            </Chip>
          ))}
        </div>
      </div>

      <div className="ag-project-modal__files">
        <span className="ag-project-modal__filetitle">Archivos que vas a subir</span>
        <MediaPicker {...photos} heading={null}>
          <Button variant="line" icon="mic" onClick={() => audioInput.current?.click()} disabled={Boolean(audio)}>
            <span>Agregar audio</span>
            <FCode>F5</FCode>
          </Button>
          <input
            ref={audioInput}
            type="file"
            hidden
            aria-label="Elegir un audio"
            accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,.mp3,.m4a,.ogg,.webm"
            onChange={pickAudio}
          />
        </MediaPicker>
        {audioProblem && (
          <p role="alert" className="ag-error">
            {audioProblem}
          </p>
        )}
        {audio && (
          <ul className="ag-attached" aria-label="Audio agregado">
            <li className="ag-attached__item">
              <b>Audio</b>
              <span>
                {audio.name}
                {audio.blob || audio.bytes ? ` · ${formatBytes(audio.blob?.size ?? audio.bytes)}` : ''}
                {audio.seconds ? ` · ${formatDuration(audio.seconds)}` : ''}
              </span>
              <button type="button" className="ag-attached__remove" aria-label={`Quitar ${audio.name}`} onClick={() => setAudio(null)}>
                <Icon name="cerrar" size={14} strokeWidth={2.4} />
              </button>
            </li>
          </ul>
        )}
      </div>

      <div className="ag-consent">
        <label className="ag-consent__box">
          <input type="checkbox" checked={accepted} onChange={(event) => setConsent(event.target.checked ? acceptConsent(choice) : null)} aria-required="true" />
          <span className="ag-consent__text">{authorization.texto}</span>
        </label>
      </div>

      {busy && video && progress != null && (
        <p role="status" className="ag-hint">
          Subiendo el video… {progress} %
        </p>
      )}
      {error && (
        <p role="alert" className="ag-error">
          {error}
        </p>
      )}
      <button type="button" className="ag-mbtn ag-mbtn--project ag-mbtn--full" onClick={publish} disabled={!valid || busy}>
        {editing ? (busy ? 'Guardando…' : 'Guardar cambios') : busy ? 'Publicando…' : 'Publicar historia del proyecto'}
      </button>
    </Modal>
  )
}
