import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { deleteStoryForever, fetchTrash, restoreStory } from '../../services/admin.js'
import { ApiError, OfflineError } from '../../services/http.js'

const TITLE = 'Papelera'
const SUBTITLE = 'Las historias borradas. Durante 30 días puedes recuperarlas; después se borran para siempre.'

const failureText = (failure, fallback) =>
  failure instanceof OfflineError
    ? 'Sin señal: no se hizo el cambio. Inténtalo cuando vuelva la conexión.'
    : failure instanceof ApiError
      ? failure.message
      : fallback

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/**
 * The trash (only the main administrator, like «Borrar historia»): a deleted story stays here 30 days, off the map and off
 * every list, with its photos, audio and video. «Recuperar» publishes it again as it was; «Borrar para siempre» deletes it
 * and its files at once. When its 30 days pass the server deletes it for good the next time the trash is opened.
 */
export default function TrashPage() {
  const { user } = useAuth()
  const { reload: reloadPortal } = usePortalData()
  const toast = useToast()
  const [stories, setStories] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [problem, setProblem] = useState('')
  const [confirming, setConfirming] = useState(null) // code of the story about to be deleted for good
  const [busy, setBusy] = useState(null) // code of the story being restored or deleted

  const isMain = Boolean(user?.principal)

  const load = useCallback(async () => {
    try {
      setStories(await fetchTrash())
      setLoadError('')
    } catch (failure) {
      setLoadError(
        failure instanceof OfflineError
          ? 'Sin señal: no pudimos traer la papelera. Inténtalo cuando vuelva la conexión.'
          : failureText(failure, 'No pudimos traer la papelera. Intenta de nuevo.'),
      )
    }
  }, [])

  useEffect(() => {
    if (isMain) load()
  }, [load, isMain])

  /** Runs a change on one story; on success it leaves the list and the toast says so. Returns whether it worked. */
  const act = async (story, action, fallback, done) => {
    setBusy(story.codigo)
    setProblem('')
    try {
      await action(story.codigo)
    } catch (failure) {
      setProblem(failureText(failure, fallback))
      return false
    } finally {
      setBusy(null)
    }
    setConfirming(null)
    setStories((current) => current.filter((item) => item.codigo !== story.codigo))
    toast(done)
    return true
  }

  const restore = async (story) => {
    const done = `«${story.titulo}» volvió a publicarse: ya está otra vez en el mapa.`
    if (await act(story, restoreStory, 'No pudimos recuperarla. Intenta de nuevo.', done)) reloadPortal() // the counters change
  }

  const deleteForever = (story) =>
    act(story, deleteStoryForever, 'No pudimos borrarla. Intenta de nuevo.', `Se borró para siempre «${story.titulo}».`)

  if (!isMain) {
    return (
      <>
        <PageHeader title={TITLE} subtitle={SUBTITLE} />
        <div className="ag-settings">
          <section className="ag-card" aria-label={TITLE}>
            <span className="ag-card__help">Solo el administrador principal puede ver la papelera y recuperar historias.</span>
          </section>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUBTITLE} />

      <div className="ag-settings">
        <section className="ag-card" aria-label="Historias en la papelera">
          <h2>Historias en la papelera</h2>
          <span className="ag-card__help">
            Mientras están aquí no salen en el mapa ni en ninguna lista, tampoco en «Mis historias» de quien la contó. Sus fotos, audios y video
            se guardan hasta que se borre para siempre.
          </span>

          {loadError && (
            <p role="alert" className="ag-error">
              {loadError}
            </p>
          )}
          {problem && (
            <p role="alert" className="ag-error">
              {problem}
            </p>
          )}
          {stories === null && !loadError && <span className="ag-card__help">Cargando…</span>}
          {stories?.length === 0 && <span className="ag-card__help">La papelera está vacía.</span>}

          <ul className="ag-admins">
            {(stories ?? []).map((story) => (
              <li key={story.codigo} className="ag-admins__row">
                <div className="ag-admins__who">
                  <b>{story.titulo}</b>
                  <span className="ag-card__note">
                    {story.codigo} · Narra {story.narrador_nombre || 'sin nombre'}
                  </span>
                  <span className="ag-card__note">
                    Borrada el {formatDate(story.borrada_en)} · Se borra para siempre el {formatDate(story.se_borra_el)}
                  </span>
                  {confirming === story.codigo && (
                    <span className="ag-card__note">
                      <b>Se borran también sus fotos, audios y video. No se puede deshacer.</b>
                    </span>
                  )}
                </div>
                {confirming === story.codigo ? (
                  <div className="ag-admins__confirm">
                    <button type="button" className="ag-card__danger" onClick={() => deleteForever(story)} disabled={busy === story.codigo}>
                      {busy === story.codigo ? 'Borrando…' : 'Sí, borrar para siempre'}
                    </button>
                    <button type="button" className="ag-card__link" onClick={() => setConfirming(null)} disabled={busy === story.codigo}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="ag-admins__confirm">
                    <button
                      type="button"
                      className="ag-card__link"
                      aria-label={`Recuperar «${story.titulo}»`}
                      onClick={() => restore(story)}
                      disabled={busy === story.codigo}
                    >
                      {busy === story.codigo ? 'Recuperando…' : 'Recuperar'}
                    </button>
                    <button
                      type="button"
                      className="ag-card__danger"
                      aria-label={`Borrar para siempre «${story.titulo}»`}
                      onClick={() => setConfirming(story.codigo)}
                      disabled={busy === story.codigo}
                    >
                      Borrar para siempre
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
