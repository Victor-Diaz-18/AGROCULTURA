import { useEffect, useState } from 'react'
import DemoResetDialog from '../../components/admin/DemoResetDialog.jsx'
import PageHeader from '../../components/layout/PageHeader.jsx'
import Icon from '../../components/ui/Icon.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'
import Switch from '../../components/ui/Switch.jsx'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { codeNote } from '../../config/flags.js'
import { useToast } from '../../context/ToastContext.jsx'
import { addTag, removeTag, updatePortal } from '../../services/admin.js'
import { ApiError, OfflineError } from '../../services/http.js'

const TEXT = {
  portal: `Lo que puede cambiar el administrador${codeNote('F7')}.`,
  admin: 'Ajustes que solo puede cambiar un administrador.',
}

const failureText = (failure) =>
  failure instanceof OfflineError
    ? 'Sin señal: el cambio no se guardó. Inténtalo cuando vuelva la conexión.'
    : failure instanceof ApiError
      ? failure.message
      : 'No pudimos guardar el cambio. Intenta de nuevo.'

/** Portal settings: name, moderation, sectors, tags (F7). Shared by the portal and the admin panel. */
export default function SettingsPage({ variant = 'portal' }) {
  const { config, reload } = usePortalData()
  const toast = useToast()
  const { portal } = config
  const [name, setName] = useState(portal.nombre)
  const [nameError, setNameError] = useState('')
  const [newTag, setNewTag] = useState('')
  const [tagError, setTagError] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => setName(portal.nombre), [portal.nombre])

  /** Saves one option; the app reloads its configuration so the change shows everywhere. */
  const save = async (changes, message) => {
    try {
      await updatePortal(changes)
    } catch (failure) {
      toast(failureText(failure), 'info')
      return false
    }
    await reload()
    if (message) toast(message)
    return true
  }

  const saveName = async () => {
    const clean = name.replace(/\s+/g, ' ').trim()
    if (clean === portal.nombre) return setName(portal.nombre)
    if (clean.length < 2 || clean.length > 60) return setNameError('El nombre debe tener entre 2 y 60 letras.')
    setNameError('')
    if (!(await save({ nombre: clean }, 'Nombre del portal guardado.'))) setNameError('No se pudo guardar el nombre.')
  }

  const submitTag = async (event) => {
    event.preventDefault()
    if (!newTag.trim()) return
    setTagError('')
    try {
      await addTag(newTag)
    } catch (failure) {
      setTagError(failureText(failure))
      return
    }
    setNewTag('')
    await reload()
    toast('Etiqueta agregada.')
  }

  const dropTag = async (tag) => {
    try {
      await removeTag(tag)
    } catch (failure) {
      toast(failureText(failure), 'info')
    }
    await reload()
  }

  return (
    <>
      <PageHeader
        title="Configuración del portal"
        subtitle={TEXT[variant]}
        actions={variant === 'portal' ? <ListenButton title="Configuración del portal" text={`Configuración del portal. ${TEXT.portal}`} /> : null}
      />

      <div className="ag-settings">
        <section className="ag-card" aria-label="Portal">
          <h2>Portal</h2>
          <label className="ag-card__field">
            Nombre del portal
            <input
              type="text"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            />
          </label>
          {nameError && (
            <p role="alert" className="ag-error">
              {nameError}
            </p>
          )}
          <span className="ag-card__warn">El nombre definitivo está por confirmar con el profesor.</span>
          <Switch checked={portal.datos_de_ejemplo} onChange={(value) => save({ datos_de_ejemplo: value })}>
            <b>Mostrar «datos de ejemplo» en el encabezado.</b> Apágalo antes de usar la plataforma con familias reales.
          </Switch>
        </section>

        <section className="ag-card" aria-label="Moderación">
          <h2>Moderación</h2>
          <Switch checked disabled>
            <b>Toda historia pasa por revisión.</b> Fijo: es un criterio del proyecto.
          </Switch>
          <Switch checked={portal.avisar_rechazo} onChange={(value) => save({ avisar_rechazo: value })}>
            <b>Avisar al narrador si se rechaza.</b> Por definir con el profesor.
          </Switch>
        </section>

        <section className="ag-card" aria-label="Sectores del mapa">
          <h2>Sectores del mapa</h2>
          <ul className="ag-card__chips">
            {config.sectores.map((sector) => (
              <li key={sector.id} className="ag-sectorchip">
                {sector.nombre}
                {sector.provisional && <small className="ag-sectorchip__note"> · punto por confirmar</small>}
              </li>
            ))}
          </ul>
          <span className="ag-card__note">Los sectores y sus límites se confirmarán con las familias de la zona.</span>
        </section>

        <section className="ag-card" aria-label="Etiquetas">
          <h2>Etiquetas</h2>
          {variant === 'admin' && <span className="ag-card__help">Son las que el narrador puede elegir al contar una historia.</span>}
          <ul className="ag-card__chips">
            {config.etiquetas.map((tag) => (
              <li key={tag} className="ag-tagchip">
                <span>{tag}</span>
                <button type="button" aria-label={`Quitar ${tag}`} onClick={() => dropTag(tag)}>
                  <Icon name="cerrar" size={12} strokeWidth={2.6} />
                </button>
              </li>
            ))}
          </ul>
          <form className="ag-card__add" onSubmit={submitTag}>
            <input
              type="text"
              aria-label="Nueva etiqueta"
              value={newTag}
              onChange={(event) => {
                setTagError('')
                setNewTag(event.target.value)
              }}
              placeholder="#nueva-etiqueta"
            />
            <button type="submit">Agregar</button>
          </form>
          {tagError && (
            <p role="alert" className="ag-error">
              {tagError}
            </p>
          )}
        </section>

        {variant === 'admin' && portal.reinicio_disponible && (
          <section className="ag-card" aria-label="Datos de ejemplo">
            <h2>Datos de ejemplo</h2>
            <span className="ag-card__help">
              Para mostrar el portal con historias de ejemplo. Al reiniciar se borran <b>todas</b> las historias, también las reales, y se
              cargan las 12 de ejemplo.
            </span>
            <button type="button" className="ag-card__danger" onClick={() => setResetting(true)}>
              Reiniciar datos de ejemplo
            </button>
          </section>
        )}
      </div>

      {resetting && <DemoResetDialog onClose={() => setResetting(false)} />}
    </>
  )
}
