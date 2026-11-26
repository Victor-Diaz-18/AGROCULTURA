import { useState } from 'react'
import { COMPROBACIONES } from '../../config/constants.js'
import { SHOW_CODES } from '../../config/flags.js'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { approveStory, correctStory, rejectStory } from '../../services/admin.js'
import { ApiError, OfflineError } from '../../services/http.js'
import { consentTextOf } from '../../utils/consent.js'
import { formatDate } from '../../utils/format.js'
import StoryMedia from '../story/StoryMedia.jsx'
import Icon from '../ui/Icon.jsx'
import Chip from '../ui/Chip.jsx'
import Modal from '../ui/Modal.jsx'
import YearsField from '../tell/YearsField.jsx'
import { LIMITS } from '../../config/constants.js'
import { checkYears, parseYear } from '../../utils/years.js'
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
 * `onCorrected()` runs after the team corrected the title or the text, so the page can show the new title in its list.
 *
 * «Editar la historia» corrects what is written in it (title, text, years, names, tags); the rest is the narrator's. What they wrote stays for the team to read,
 * and once it is published the narrator reads in «Mis historias» that the team corrected it.
 */
/** What else the narrator wrote, shown when the team changed it. */
const ORIGINAL_FIELDS = [
  ['epoca', 'Años'],
  ['lugar_nombre', 'Nombre del lugar'],
  ['finca_nombre', 'Finca o marca'],
  ['etiquetas', 'Etiquetas'],
]

export default function ReviewModal({ story: given, queue, variant = 'portal', onClose, onDecided, onStale, onCorrected }) {
  const { config, reload: reloadPortal } = usePortalData()
  const toast = useToast()
  const [corrected, setCorrected] = useState(null) // the story as the server answered the correction
  const story = corrected ?? given
  const [checked, setChecked] = useState([])
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // { titulo, texto, desde, hasta, lugar, finca, etiquetas } while correcting
  const [editError, setEditError] = useState('')

  const consent = story.consentimiento
  const allChecked = Boolean(consent) && COMPROBACIONES.every(({ id }) => checked.includes(id))
  const position = queue.findIndex((item) => item.codigo === story.codigo)
  const sectorName = placeLine(story, config.sectores)
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

  const saveCorrection = async (event) => {
    event.preventDefault()
    const titulo = editing.titulo.replace(/\s+/g, ' ').trim()
    if (titulo.length < 3) return setEditError('El título debe tener al menos 3 letras.')
    if (story.texto && !editing.texto.trim()) return setEditError('El texto no puede quedar vacío. Si la historia no sirve, recházala.')
    const yearsProblem = editing.desde.trim() ? checkYears(editing.desde, editing.hasta) : ''
    if (yearsProblem) return setEditError(yearsProblem)
    const years = editing.desde.trim()
      ? { anio_desde: parseYear(editing.desde), anio_hasta: parseYear(editing.hasta) ?? parseYear(editing.desde) }
      : {} // left empty: the years stay as the narrator wrote them
    setBusy(true)
    setEditError('')
    try {
      setCorrected(
        await correctStory(story.codigo, {
          titulo,
          texto: editing.texto,
          ...years,
          lugar_nombre: editing.lugar.trim() || null,
          finca_nombre: editing.finca.trim() || null,
          etiquetas: editing.etiquetas,
        }),
      )
    } catch (failure) {
      if (failure instanceof OfflineError) setEditError('Sin señal: la corrección no se guardó. Inténtalo cuando vuelva la conexión.')
      else setEditError(failure instanceof ApiError ? failure.message : 'No pudimos guardar la corrección. Intenta de nuevo.')
      if (failure instanceof ApiError && failure.status === 409) onStale?.()
      return
    } finally {
      setBusy(false)
    }
    setEditing(null)
    toast('Corrección guardada. Cuando se publique, el narrador verá que el equipo la corrigió.')
    onCorrected?.()
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
          {editing ? (
            <form className="ag-review-modal__edit" onSubmit={saveCorrection} noValidate aria-label="Corregir la historia">
              <label>
                Título
                <input
                  value={editing.titulo}
                  maxLength={120}
                  autoFocus
                  onChange={(event) => setEditing({ ...editing, titulo: event.target.value })}
                />
              </label>
              {story.texto && (
                <label>
                  Texto
                  <textarea rows={8} value={editing.texto} onChange={(event) => setEditing({ ...editing, texto: event.target.value })} />
                </label>
              )}
              <YearsField
                id="ag-corregir-anios"
                desde={editing.desde}
                hasta={editing.hasta}
                onDesde={(desde) => setEditing({ ...editing, desde })}
                onHasta={(hasta) => setEditing({ ...editing, hasta })}
              />
              {!/^\d{4}( a \d{4})?$/.test(story.epoca ?? '') && (
                <span className="ag-hint">Ahora dice «{story.epoca}». Si dejas los años vacíos, queda así.</span>
              )}
              <label>
                {story.ubicacion_modo === 'ninguna' ? 'Nombre de referencia (opcional)' : 'Nombre del lugar (opcional)'}
                <input
                  className="ag-review-modal__plain"
                  value={editing.lugar}
                  maxLength={80}
                  onChange={(event) => setEditing({ ...editing, lugar: event.target.value })}
                />
              </label>
              <label>
                Nombre de la finca o marca (opcional)
                <input
                  className="ag-review-modal__plain"
                  value={editing.finca}
                  maxLength={80}
                  onChange={(event) => setEditing({ ...editing, finca: event.target.value })}
                />
              </label>
              <fieldset className="ag-review-modal__tags">
                <legend>Etiquetas</legend>
                {[...new Set([...config.etiquetas, ...editing.etiquetas])].map((tag) => (
                  <Chip
                    key={tag}
                    size="sm"
                    pressed={editing.etiquetas.includes(tag)}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        etiquetas: editing.etiquetas.includes(tag)
                          ? editing.etiquetas.filter((item) => item !== tag)
                          : editing.etiquetas.length >= LIMITS.etiquetas
                            ? editing.etiquetas
                            : [...editing.etiquetas, tag],
                      })
                    }
                  >
                    {tag}
                  </Chip>
                ))}
              </fieldset>
              <span className="ag-hint">
                Lo que escribió el narrador queda guardado. El lugar en el mapa, los archivos, si sale con su nombre y la autorización
                son decisiones del narrador: no se cambian aquí.
              </span>
              {editError && (
                <p role="alert" className="ag-error">
                  {editError}
                </p>
              )}
              <div className="ag-review-modal__edit-buttons">
                <button type="submit" className="ag-mbtn ag-mbtn--approve" disabled={busy}>
                  {busy ? 'Guardando…' : 'Guardar corrección'}
                </button>
                <button type="button" className="ag-mbtn ag-mbtn--ghost" onClick={() => setEditing(null)} disabled={busy}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <h2 className="ag-review-modal__title">{story.titulo}</h2>
              <button
                type="button"
                className="ag-review-modal__correct"
                onClick={() => {
                  setEditError('')
                  const told = story.anio_desde != null && /^\d{4}( a \d{4})?$/.test(story.epoca ?? '') // written years, not a period of before
                  setEditing({
                    titulo: story.titulo,
                    texto: story.texto ?? '',
                    desde: told ? String(story.anio_desde) : '',
                    hasta: told && story.anio_hasta !== story.anio_desde ? String(story.anio_hasta) : '',
                    lugar: story.lugar_nombre ?? '',
                    finca: story.finca_nombre ?? '',
                    etiquetas: story.etiquetas ?? [],
                  })
                }}
                disabled={busy}
              >
                Editar la historia
              </button>
            </>
          )}
          <span className="ag-review-modal__meta">
            Narra {story.narrador_nombre} · {sectorName} · {story.epoca} · enviada {formatDate(story.enviada_en)}
          </span>
          {story.correccion && (
            <details className="ag-review-modal__original">
              <summary>
                Corregida por {story.correccion.por} el {formatDate(story.correccion.en)}. Ver lo que escribió el narrador
              </summary>
              <b>{story.correccion.titulo}</b>
              {story.correccion.texto && <p>{story.correccion.texto}</p>}
              {ORIGINAL_FIELDS.filter(([field]) => story.correccion.campos?.includes(field)).map(([field, label]) => (
                <p key={field}>
                  {label}: {[].concat(story.correccion[field] ?? '—').join(' ') || '—'}
                </p>
              ))}
            </details>
          )}
          <div className="ag-review-modal__formats">
            {story.formatos.map((format) => (
              <span key={format} className="ag-format ag-format--lg">
                {format}
              </span>
            ))}
          </div>
          {story.texto && !editing && <p className="ag-review-modal__text">{story.texto}</p>}
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
            <button type="button" className="ag-mbtn ag-mbtn--reject" onClick={() => setRejecting(true)} disabled={busy || Boolean(editing)}>
              Rechazar
            </button>
            <button type="button" className="ag-mbtn ag-mbtn--approve" onClick={() => decide(true)} disabled={!allChecked || busy || Boolean(editing)}>
              Aprobar y publicar
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
