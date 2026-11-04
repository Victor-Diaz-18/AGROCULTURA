import Modal from '../ui/Modal.jsx'

/**
 * Asks before something kept on the phone is thrown away: it was never sent, so nobody else has a copy.
 * `video`: it is the video of a story that is already on the server (the story stays, without it).
 */
export default function DiscardDraftDialog({ title, video = false, onConfirm, onClose }) {
  return (
    <Modal open onClose={onClose} label={video ? 'Quitar video' : 'Quitar borrador'} maxWidth={460} level={55} top={80} className="ag-project-modal">
      <h2 className="ag-project-modal__title">{video ? '¿Quitar este video?' : '¿Quitar este borrador?'}</h2>
      <p className="ag-reset__warning">
        {video
          ? `El video de «${title}» todavía no se subió y solo está en este dispositivo. Si lo quitas, la historia sigue en revisión pero sin video, y no se puede recuperar.`
          : `«${title}» todavía no se ha enviado y solo está en este dispositivo. Si la quitas, se pierde y no se puede recuperar.`}
      </p>
      <div className="ag-review-modal__footer ag-reset__footer">
        <button type="button" className="ag-mbtn ag-mbtn--ghost" onClick={onClose}>
          {video ? 'No, dejarlo' : 'No, dejarla'}
        </button>
        <button type="button" className="ag-mbtn ag-mbtn--danger" onClick={onConfirm}>
          {video ? 'Sí, quitarlo' : 'Sí, quitarla'}
        </button>
      </div>
    </Modal>
  )
}
