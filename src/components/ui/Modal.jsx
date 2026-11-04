import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Dialog over a dimmed backdrop (story card, review, login...).
 * Closes with Escape or a click on the backdrop; focus returns to the opener.
 */
export default function Modal({ open, onClose, label, maxWidth = 520, level = 50, top = 40, className = '', children }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    dialogRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div
      className="ag-modal-backdrop"
      style={{ zIndex: level, paddingTop: top, paddingBottom: top }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`ag-modal ${className}`.trim()}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
