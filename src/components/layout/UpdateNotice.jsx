import { useState } from 'react'
import { useOutbox } from '../../context/OutboxContext.jsx'
import useAppUpdate from '../../hooks/useAppUpdate.js'

/**
 * "Hay una versión nueva". Appears when the app has a newer version waiting; the person chooses when to switch
 * (it reloads the page) or leaves it for later (it comes back the next time the app opens).
 */
export default function UpdateNotice() {
  const { available, applying, failed, apply } = useAppUpdate()
  const { persistent } = useOutbox()
  const [later, setLater] = useState(false)
  if (!available || later) return null

  return (
    <div role="status" className="ag-update">
      <div className="ag-update__text">
        <b>Hay una versión nueva.</b>
        {failed ? (
          <span>No se pudo actualizar: parece que no hay señal. Inténtalo de nuevo cuando vuelva la conexión.</span>
        ) : (
          <span>
            Al actualizar, la página se vuelve a cargar.{' '}
            {persistent
              ? 'Lo que llevas de tu historia se guarda en el dispositivo.'
              : 'Si estás contando una historia, envíala antes: en este teléfono no se puede guardar.'}
          </span>
        )}
      </div>
      <div className="ag-update__actions">
        <button type="button" className="ag-update__now" onClick={() => apply()} disabled={applying}>
          {applying ? 'Actualizando…' : 'Actualizar'}
        </button>
        <button type="button" className="ag-update__later" onClick={() => setLater(true)} disabled={applying}>
          Después
        </button>
      </div>
    </div>
  )
}
