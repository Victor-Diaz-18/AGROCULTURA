import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { fetchNarrators, resetNarratorPassword } from '../../services/admin.js'
import { ApiError, OfflineError } from '../../services/http.js'

// The same rule as when the account is made (lib/auth/schemas.py): the server has the last word.
const MIN_PASSWORD = 6

const failureText = (failure) =>
  failure instanceof OfflineError
    ? 'Sin señal: la contraseña no se cambió. Inténtalo cuando vuelva la conexión.'
    : failure instanceof ApiError
      ? failure.message
      : 'No pudimos cambiar la contraseña. Intenta de nuevo.'

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/** Without accents or capitals, so «jose» finds «José Peña». */
const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const storiesText = (count) => (count === 1 ? '1 historia' : `${count} historias`)

/**
 * Narrators (any administrator gets here): to find a family's account and give it a new password when they forget theirs.
 * There is no recovery by e-mail or SMS: the family asks the team, the administrator writes a password here and tells it to
 * them. It becomes their password, the sessions they had open on other phones close, and it records who changed it.
 */
export default function NarratorsPage() {
  const toast = useToast()
  const [narrators, setNarrators] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // id of the narrator getting a new password
  const [clave, setClave] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setNarrators(await fetchNarrators())
      setLoadError('')
    } catch (failure) {
      setLoadError(
        failure instanceof OfflineError ? 'Sin señal: no pudimos traer la lista. Inténtalo cuando vuelva la conexión.' : failureText(failure),
      )
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => {
    const words = fold(search.trim())
    return (narrators ?? []).filter((narrator) => !words || fold(`${narrator.nombre} ${narrator.usuario}`).includes(words))
  }, [narrators, search])

  const open = (id) => {
    setEditing(id)
    setClave('')
    setFormError('')
  }
  const close = () => open(null)

  const submit = async (event, narrator) => {
    event.preventDefault()
    if (clave.length < MIN_PASSWORD) return setFormError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
    setSaving(true)
    let updated
    try {
      updated = await resetNarratorPassword(narrator.id, clave)
    } catch (failure) {
      setFormError(failureText(failure))
      return
    } finally {
      setSaving(false)
    }
    setNarrators((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    close()
    toast(`Listo. ${narrator.nombre} ya puede entrar con la contraseña nueva.`)
  }

  return (
    <>
      <PageHeader title="Narradores" subtitle="Las cuentas de las familias que cuentan historias. Aquí le das una contraseña nueva a quien olvidó la suya." />

      <div className="ag-settings">
        <section className="ag-card" aria-label="Narradores">
          <h2>Narradores</h2>
          <span className="ag-card__help">
            Busca la cuenta, toca «Cambiar contraseña» y escribe una nueva. Desde ese momento será su contraseña: díctasela a la familia. Si
            tenía la cuenta abierta en otro celular, allí tendrá que ingresar de nuevo. Queda registrado quién la cambió.
          </span>

          <label className="ag-card__field">
            Buscar por nombre o usuario
            <input type="search" value={search} autoComplete="off" onChange={(event) => setSearch(event.target.value)} />
          </label>

          {loadError && (
            <p role="alert" className="ag-error">
              {loadError}
            </p>
          )}
          {narrators === null && !loadError && <span className="ag-card__help">Cargando…</span>}
          {narrators?.length === 0 && <span className="ag-card__help">Todavía no hay narradores con cuenta.</span>}
          {narrators?.length > 0 && shown.length === 0 && (
            <span className="ag-card__help">Nadie con ese nombre. Prueba con otra parte del nombre, o con el usuario con el que entra.</span>
          )}

          <ul className="ag-admins">
            {shown.map((narrator) => (
              <li key={narrator.id} className="ag-admins__row">
                <div className="ag-admins__who">
                  <b>{narrator.nombre}</b> <span className="ag-card__note">Entra como: {narrator.usuario}</span>
                  <span className="ag-card__note">
                    {storiesText(narrator.historias)}
                    {narrator.ultimo_ingreso && ` · Entró por última vez el ${formatDate(narrator.ultimo_ingreso)}`}
                    {narrator.clave_restablecida_por &&
                      ` · Contraseña cambiada por ${narrator.clave_restablecida_por} el ${formatDate(narrator.clave_restablecida_en)}`}
                  </span>
                </div>
                {editing === narrator.id ? (
                  <form className="ag-narrators__reset" onSubmit={(event) => submit(event, narrator)} noValidate>
                    <label className="ag-card__field">
                      Contraseña nueva para {narrator.nombre}
                      <input
                        type="text"
                        value={clave}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        autoFocus
                        onChange={(event) => {
                          setFormError('')
                          setClave(event.target.value)
                        }}
                      />
                      <span className="ag-card__note">{MIN_PASSWORD} caracteres o más, fácil de dictar y de recordar.</span>
                    </label>
                    {formError && (
                      <p role="alert" className="ag-error">
                        {formError}
                      </p>
                    )}
                    <div className="ag-admins__confirm">
                      <button type="submit" className="ag-card__submit" disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar contraseña'}
                      </button>
                      <button type="button" className="ag-card__link" onClick={close}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="ag-card__link" aria-label={`Cambiar la contraseña de ${narrator.nombre}`} onClick={() => open(narrator.id)}>
                    Cambiar contraseña
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
