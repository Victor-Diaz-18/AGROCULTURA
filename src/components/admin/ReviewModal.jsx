import { useState } from 'react'
import { COMPROBACIONES, NARRADOR_ANONIMO } from '../../config/constants.js'
import { SHOW_CODES } from '../../config/flags.js'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { approveStory, rejectStory } from '../../services/admin.js'
import { ApiError, OfflineError } from '../../services/http.js'
import { consentTextOf } from '../../utils/consent.js'
import { formatDate } from '../../utils/format.js'
import StoryMedia from '../story/StoryMedia.jsx'
import Icon from '../ui/Icon.jsx'
import Modal from '../ui/Modal.jsx'
import { placeLine } from '../../utils/geo.js'

/**
 * Review of one story (F6): read it, hear it, see it, tick the checks and approve; or reject with a reason.
 * The team sees what the public will not: the real name of a story published without it, the reference of a story that has no place
 * on the map, and the authorization its narrator gave (which text, which version, when). A story with no record of an authorization
 * cannot be published (the server refuses it too): it is rejected with its own reason.
 *
 * `queue`: the stories waiting for review, in order (to say "2 de 5" and to go on to the next).
 * `variant`: "admin" goes on to the next story after a decision; "portal" closes.
 * `onDecided(nextCode)` runs after a decision: the page reloads its list and opens `nextCode` (or nothing).
 * `onStale()` runs when somebody else decided this story first, so the page can reload.
 */
export default function ReviewModal({ story, queue, variant = 'portal', onClose, onDecided, onStale }) {
  const { config, reload: reloadPortal } = usePortalData()
  const toast = useToast()
  const [checked, setChecked] = useState([])
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const consent = story.consentimiento
  const allChecked = Boolean(consent) && COMPROBACIONES.every(({ id }) => checked.includes(id))
  const position = queue.findIndex((item) => item.codigo === story.codigo)
  const sectorName = placeLine(story, config.sectores)
  const noPlace = story.ubicacion_modo === 'ninguna'
  const acceptedText = consentTextOf(consent)

  const toggle = (id) => setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  const decide = async (approve) => {
    setBusy(true)
    setError('')
    try {
      if (approve) await approveStory(story.codigo, checked)
      else await rejectStory(story.codigo, reason)
    } catch (failure) {
      setBusy(false)
      if (failure instanceof OfflineError) setError('Sin señal: no pudimos guardar tu decisión. Inténtalo cuando vuelva la conexión.')
      else setError(failure instanceof ApiError ? failure.message : 'No pudimos guardar tu decisión. Intenta de nuevo.')
      if (failure instanceof ApiError && failure.status === 409) onStale?.()
      return
    }
    const next = variant === 'admin' ? queue.find((item) => item.codigo !== story.codigo) : undefined
    toast(
      `${approve ? 'Publicada: ya aparece en el mapa.' : 'Rechazada: no se publica.'}${next ? ' Siguiente en la fila.' : ''}`,
      approve ? 'ok' : 'info',
    )
    reloadPortal() // the counters in the header and the menu change
    onDecided?.(next?.codigo ?? null)
  }

  return (
    <Modal open onClose={onClose} label="Revisar historia" maxWidth={880} level={50} top={40}>
      <div className="ag-review-modal__head">
        <div className="ag-review-modal__id">
          {variant === 'portal' && <span className="ag-review-modal__kicker">Revisar historia{SHOW_CODES ? ' · F6' : ''}</span>}
          <span className="ag-review-modal__line">
            <span className="ag-review-modal__code">{story.codigo}</span>
            <span className="ag-review-modal__state">Por revisar</span>
            {variant === 'admin' && position >= 0 && (
              <span className="ag-review-modal__position">
                {position + 1} de {queue.length}
              </span>
            )}
          </span>
        </div>
        <button type="button" className="ag-close" aria-label="Cerrar" onClick={onClose}>
          <Icon name="cerrar" size={16} strokeWidth={2.4} />
        </button>
      </div>

      <div className="ag-review-modal__body">
        <div className="ag-review-modal__story">
          <h2 className="ag-review-modal__title">{story.titulo}</h2>
          <span className="ag-review-modal__meta">
            Narra {story.narrador_nombre} · {sectorName} · {story.epoca} · enviada {formatDate(story.enviada_en)}
          </span>
          {(story.anonima || noPlace || story.finca_nombre) && (
            <ul className="ag-review-modal__private" aria-label="Lo que el público no ve de esta historia">
              {story.anonima && <li>Se publicará como «{NARRADOR_ANONIMO}»: solo el equipo ve el nombre.</li>}
              {noPlace && <li>Se publicará sin ubicación en el mapa{story.lugar_nombre ? `. Referencia (solo para el equipo): ${story.lugar_nombre}` : ''}.</li>}
              {story.finca_nombre && <li>Finca o marca (se verá en la ficha): {story.finca_nombre}.</li>}
            </ul>
          )}
          <div className="ag-review-modal__formats">
            {story.formatos.map((format) => (
              <span key={format} className="ag-format ag-format--lg">
                {format}
              </span>
            ))}
          </div>
          {story.texto && <p className="ag-review-modal__text">{story.texto}</p>}
          <StoryMedia medios={story.medios} />
          <div className="ag-review__tags">
            {story.etiquetas.map((tag) => (
              <span key={tag} className="ag-tagpill">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="ag-review-modal__checks">
          <span className="ag-review-modal__label">AUTORIZACIÓN DEL NARRADOR</span>
          {consent ? (
            <p className="ag-review-modal__consent">
              {acceptedText ? `«${acceptedText.texto}»` : 'Autorizó con un texto de otra versión.'}
              <span className="ag-hint">
                {consent.de === 'equipo' ? 'Lo confirmó el equipo' : 'Lo aceptó el narrador'} el {formatDate(consent.aceptado_en)} (versión {consent.version}).
              </span>
            </p>
          ) : (
            <p role="alert" className="ag-error">
              Esta historia se envió antes de que existiera la autorización del narrador. No se puede publicar: recházala con el motivo «Falta la autorización».
            </p>
          )}
          <span className="ag-review-modal__label">ANTES DE APROBAR</span>
          {COMPROBACIONES.map(({ id, texto }) => (
            <button
              key={id}
              type="button"
              role="checkbox"
              aria-checked={checked.includes(id)}
              aria-disabled={id === 'consentimiento' && !consent ? 'true' : undefined}
              className="ag-check"
              onClick={() => (id === 'consentimiento' && !consent ? undefined : toggle(id))}
            >
              <span className="ag-check__box">
                <Icon name="check" size={12} strokeWidth={3.5} />
              </span>
              <span>{texto}</span>
            </button>
          ))}
          {rejecting && (
            <>
              <label className="ag-review-modal__reason">
                Motivo del rechazo
                <select value={reason} onChange={(event) => setReason(event.target.value)}>
                  <option value="">Elige un motivo</option>
                  {config.motivos_rechazo.map((motive) => (
                    <option key={motive.id} value={motive.id}>
                      {motive.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <span className="ag-hint">El narrador verá este motivo en «Mis historias».</span>
            </>
          )}
          {error && (
            <p role="alert" className="ag-error">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="ag-review-modal__footer">
        {rejecting ? (
          <>
            <button type="button" className="ag-mbtn ag-mbtn--ghost" onClick={() => { setRejecting(false); setReason('') }} disabled={busy}>
              Volver
            </button>
            <button type="button" className="ag-mbtn ag-mbtn--danger" onClick={() => decide(false)} disabled={!reason || busy}>
              Confirmar rechazo
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ag-mbtn ag-mbtn--reject" onClick={() => setRejecting(true)} disabled={busy}>
              Rechazar
            </button>
            <button type="button" className="ag-mbtn ag-mbtn--approve" onClick={() => decide(true)} disabled={!allChecked || busy}>
              Aprobar y publicar
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
