import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/** Not hidden by CSS (a control that cannot be seen cannot take the focus). */
const isShown = (element) => {
  const style = getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

const FOCUSABLE = 'a[href], button, input, select, textarea, audio[controls], video[controls], [tabindex]:not([tabindex="-1"])'

/**
 * Dialog over a dimmed backdrop (story card, review, login...).
 * Closes with Escape or a click on the backdrop; focus returns to the opener; Tab stays inside while it is open.
 */
export default function Modal({ open, onClose, label, maxWidth = 520, level = 50, top = 40, className = '', children }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    dialogRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return
      // The page behind a dialog is not reachable: Tab goes round inside it.
      const dialog = dialogRef.current
      const controls = [...dialog.querySelectorAll(FOCUSABLE)].filter((element) => !element.disabled && isShown(element))
      if (controls.length === 0) {
        event.preventDefault()
        return
      }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
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
