import { useRef, useState } from 'react'
import { LIMITS, MAX_UPLOAD_BYTES } from '../../config/constants.js'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ApiError, OfflineError } from '../../services/http.js'
import { publishProjectStory } from '../../services/admin.js'
import { readAudioDuration } from '../../utils/audio.js'
import { formatBytes, formatDuration } from '../../utils/format.js'
import { newId } from '../../utils/id.js'
import LocationPicker from '../map/LocationPicker.jsx'
import MediaPicker from '../tell/MediaPicker.jsx'
import Chip from '../ui/Chip.jsx'
import FCode from '../ui/FCode.jsx'
import Icon from '../ui/Icon.jsx'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'

/**
 * "Nueva historia del proyecto" (F12): a story the team uploads; it is published at once.
 * Photos are reduced like the narrators' (MediaPicker); the audio is a file the team already has.
 */

export const AUDIO_MESSAGES = {
  tooBig: `Ese audio pesa más de ${formatBytes(MAX_UPLOAD_BYTES)}, que es lo máximo por ahora. Comprímelo o usa un fragmento más corto.`,
}

export default function ProjectStoryModal({ onClose, onPublished }) {
  const { config, reload } = usePortalData()
  const toast = useToast()
  const [titulo, setTitulo] = useState('')
  const [location, setLocation] = useState(null) // { lat, lon, origen, sectorId }: anywhere in the zone
  const [chosenEpoca, setEpoca] = useState('')
  const [narrador, setNarrador] = useState('')
  const [texto, setTexto] = useState('')
  const [etiquetas, setEtiquetas] = useState([])
  const [fotos, setFotos] = useState([])
  const [audio, setAudio] = useState(null)
  const [audioProblem, setAudioProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [clientId] = useState(newId)
  const uploaded = useRef(new WeakMap())
  const photoNumber = useRef(1)
  const audioInput = useRef(null)

  // Neither the place nor the period have a default: a wrong one would go unnoticed.
  const epoca = chosenEpoca

  const valid = titulo.trim().length >= LIMITS.tituloMin && Boolean(location) && Boolean(epoca) && (texto.trim().length > 0 || Boolean(audio))

  const photos = {
    photos: fotos,
    nextName: () => `foto_${String(photoNumber.current++).padStart(2, '0')}.jpg`,
    onAdd: (added) => setFotos((current) => [...current, ...added]),
    onRemove: (id) => setFotos((current) => current.filter((photo) => photo.id !== id)),
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
    try {
      const story = await publishProjectStory(
        { clientId, titulo: titulo.trim(), texto: texto.trim(), epoca, location, etiquetas, narrador: narrador.trim(), audio, fotos },
        { uploaded: uploaded.current },
      )
      const sector = config.sectores.find((item) => item.id === story.sector_id)
      toast(sector ? `Historia del proyecto publicada en ${sector.nombre}.` : 'Historia del proyecto publicada.')
      reload() // the counters change
      onPublished?.(story)
    } catch (failure) {
      setBusy(false)
      if (failure instanceof OfflineError) setError('Sin señal: no pudimos publicarla. Tus datos siguen aquí; inténtalo cuando vuelva la conexión.')
      else setError(failure instanceof ApiError ? failure.message : 'No pudimos publicar la historia. Intenta de nuevo.')
    }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} label="Nueva historia del proyecto" maxWidth={520} level={55} top={60} className="ag-project-modal">
      <div className="ag-project-modal__head">
        <div>
          <h2 className="ag-project-modal__title">Nueva historia del proyecto</h2>
          <span className="ag-project-modal__sub">
            Se publica de una vez y se marca como «del proyecto».
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

      <div className="ag-project-modal__field">
        <span>¿Dónde ocurrió? Toca el lugar en el mapa</span>
        <LocationPicker sectors={config.sectores} value={location} onChange={setLocation} />
      </div>

      <label className="ag-project-modal__field">
        Época
        <select className="ag-project-modal__select" value={epoca} onChange={(event) => setEpoca(event.target.value)}>
          <option value="">Elige una época</option>
          {config.epocas.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

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
                {audio.name} · {formatBytes(audio.blob.size)}
                {audio.seconds ? ` · ${formatDuration(audio.seconds)}` : ''}
              </span>
              <button type="button" className="ag-attached__remove" aria-label={`Quitar ${audio.name}`} onClick={() => setAudio(null)}>
                <Icon name="cerrar" size={14} strokeWidth={2.4} />
              </button>
            </li>
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="ag-error">
          {error}
        </p>
      )}
      <button type="button" className="ag-mbtn ag-mbtn--project ag-mbtn--full" onClick={publish} disabled={!valid || busy}>
        {busy ? 'Publicando…' : 'Publicar historia del proyecto'}
      </button>
    </Modal>
  )
}
