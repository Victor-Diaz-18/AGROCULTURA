import { useState } from 'react'
import { usePortalData } from '../../context/PortalDataContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { resetDemoData } from '../../services/admin.js'
import { ApiError, OfflineError } from '../../services/http.js'
import Modal from '../ui/Modal.jsx'

/**
 * REMOVABLE (see lib/seed/demo.py): the confirmation of "Reiniciar datos de ejemplo".
 * It says plainly that EVERY story is deleted, the real ones too, and asks to type a word.
 */

export const CONFIRM_WORD = 'REINICIAR'

export default function DemoResetDialog({ onClose }) {
  const { reload } = usePortalData()
  const toast = useToast()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = typed.trim().toUpperCase() === CONFIRM_WORD

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await resetDemoData()
      toast(`Listo: se borraron ${result.historias_borradas} historias y se cargaron ${result.historias_de_ejemplo} de ejemplo.`)
      reload()
      onClose()
    } catch (failure) {
      setBusy(false)
      if (failure instanceof OfflineError) setError('Sin señal: no se borró nada. Inténtalo cuando vuelva la conexión.')
      else setError(failure instanceof ApiError ? failure.message : 'No pudimos reiniciar los datos. No se borró nada.')
    }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} label="Reiniciar datos de ejemplo" maxWidth={480} level={55} top={80} className="ag-project-modal">
      <h2 className="ag-project-modal__title">¿Borrar todas las historias?</h2>
      <p className="ag-reset__warning">
        Esto borra <b>todas las historias de la plataforma, incluidas las reales</b> que hayan enviado las familias, con sus fotos y audios.
        No se puede deshacer. Después se cargan las 12 historias de ejemplo.
      </p>
      <label className="ag-project-modal__field">
        Para confirmar, escribe {CONFIRM_WORD}
        <input
          type="text"
          className="ag-project-modal__input"
          value={typed}
          autoComplete="off"
          onChange={(event) => setTyped(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="ag-error">
          {error}
        </p>
      )}
      <div className="ag-review-modal__footer ag-reset__footer">
        <button type="button" className="ag-mbtn ag-mbtn--ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="ag-mbtn ag-mbtn--danger" onClick={run} disabled={!ready || busy}>
          {busy ? 'Borrando…' : 'Borrar todo y reiniciar'}
        </button>
      </div>
    </Modal>
  )
}
