import Modal from '../ui/Modal.jsx'

/** Asks before a story kept on the phone is thrown away: it was never sent, so nobody else has a copy. */
export default function DiscardDraftDialog({ title, onConfirm, onClose }) {
  return (
    <Modal open onClose={onClose} label="Quitar borrador" maxWidth={460} level={55} top={80} className="ag-project-modal">
      <h2 className="ag-project-modal__title">¿Quitar este borrador?</h2>
      <p className="ag-reset__warning">
        «{title}» todavía no se ha enviado y solo está en este dispositivo. Si la quitas, se pierde y no se puede recuperar.
      </p>
      <div className="ag-review-modal__footer ag-reset__footer">
        <button type="button" className="ag-mbtn ag-mbtn--ghost" onClick={onClose}>
          No, dejarla
        </button>
        <button type="button" className="ag-mbtn ag-mbtn--danger" onClick={onConfirm}>
          Sí, quitarla
        </button>
      </div>
    </Modal>
  )
}
