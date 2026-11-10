import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../components/layout/PageHeader.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { createAdmin, deactivateAdmin, fetchAdmins, reactivateAdmin } from '../../services/admin.js'
import { ApiError, OfflineError } from '../../services/http.js'

const MIN_PASSWORD = 10

const failureText = (failure) =>
  failure instanceof OfflineError
    ? 'Sin señal: el cambio no se guardó. Inténtalo cuando vuelva la conexión.'
    : failure instanceof ApiError
      ? failure.message
      : 'No pudimos guardar el cambio. Intenta de nuevo.'

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/** Administrators: who they are, who created each one, and who is deactivated (only an administrator gets here). */
export default function AdminsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [admins, setAdmins] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ nombre: '', usuario: '', clave: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(null) // id of the administrator about to be deactivated

  const load = useCallback(async () => {
    try {
      setAdmins(await fetchAdmins())
      setLoadError('')
    } catch (failure) {
      setLoadError(failureText(failure))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const change = (field) => (event) => {
    setFormError('')
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (form.clave.length < MIN_PASSWORD) return setFormError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
    setSaving(true)
    try {
      await createAdmin(form)
    } catch (failure) {
      setFormError(failureText(failure))
      return
    } finally {
      setSaving(false)
    }
    setForm({ nombre: '', usuario: '', clave: '' })
    toast('Administrador creado.')
    await load()
  }

  const toggle = async (admin) => {
    setConfirming(null)
    try {
      await (admin.activo ? deactivateAdmin(admin.id) : reactivateAdmin(admin.id))
    } catch (failure) {
      toast(failureText(failure), 'info')
      return load()
    }
    toast(admin.activo ? 'Administrador desactivado.' : 'Administrador reactivado.')
    await load()
  }

  return (
    <>
      <PageHeader title="Administradores" subtitle="Quiénes pueden administrar el portal, y quién creó cada cuenta." />

      <div className="ag-settings">
        <section className="ag-card" aria-label="Administradores del portal">
          <h2>Administradores</h2>
          {loadError && (
            <p role="alert" className="ag-error">
              {loadError}
            </p>
          )}
          {admins === null && !loadError && <span className="ag-card__help">Cargando…</span>}
          <ul className="ag-admins">
            {(admins ?? []).map((admin) => (
              <li key={admin.id} className="ag-admins__row">
                <div className="ag-admins__who">
                  <b>{admin.nombre}</b> <span className="ag-card__note">({admin.usuario})</span>
                  {admin.id === user?.id && <span className="ag-admins__tag"> Tú</span>}
                  {admin.principal && <span className="ag-admins__tag"> Principal</span>}
                  {!admin.activo && <span className="ag-admins__tag ag-admins__tag--off"> Desactivado</span>}
                  <span className="ag-card__note">
                    {admin.creado_por
                      ? `Creado por ${admin.creado_por} el ${formatDate(admin.creado_en)}`
                      : `Creado el ${formatDate(admin.creado_en)} desde la configuración del servidor`}
                    {!admin.activo && admin.desactivado_por && ` · Desactivado por ${admin.desactivado_por} el ${formatDate(admin.desactivado_en)}`}
                  </span>
                </div>
                {!admin.principal &&
                  admin.id !== user?.id &&
                  (confirming === admin.id ? (
                    <div className="ag-admins__confirm">
                      <button type="button" className="ag-card__danger" onClick={() => toggle(admin)}>
                        Sí, desactivar a {admin.nombre}
                      </button>
                      <button type="button" className="ag-card__link" onClick={() => setConfirming(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : admin.activo ? (
                    <button type="button" className="ag-card__danger" onClick={() => setConfirming(admin.id)}>
                      Desactivar a {admin.nombre}
                    </button>
                  ) : (
                    <button type="button" className="ag-card__link" onClick={() => toggle(admin)}>
                      Reactivar a {admin.nombre}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </section>

        <section className="ag-card" aria-label="Nuevo administrador">
          <h2>Nuevo administrador</h2>
          <span className="ag-card__help">Podrá entrar al panel con este usuario y esta contraseña. Quedará registrado que lo creaste tú.</span>
          <form className="ag-card__form" onSubmit={submit}>
            <label className="ag-card__field">
              Nombre
              <input type="text" value={form.nombre} maxLength={40} autoComplete="off" onChange={change('nombre')} required />
            </label>
            <label className="ag-card__field">
              Usuario
              <input type="text" value={form.usuario} maxLength={40} autoComplete="off" onChange={change('usuario')} required />
            </label>
            <label className="ag-card__field">
              Contraseña
              <input type="text" value={form.clave} autoComplete="off" onChange={change('clave')} required />
              <span className="ag-card__note">{MIN_PASSWORD} caracteres o más.</span>
            </label>
            {formError && (
              <p role="alert" className="ag-error">
                {formError}
              </p>
            )}
            <button type="submit" className="ag-card__submit" disabled={saving}>
              {saving ? 'Creando…' : 'Crear administrador'}
            </button>
          </form>
        </section>
      </div>
    </>
  )
}
