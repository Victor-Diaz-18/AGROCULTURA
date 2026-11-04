import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(() => {})

const TOAST_MS = 3800

/** Short messages at the bottom of the screen. `tipo`: "ok" (green dot) or "info" (yellow dot). */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const show = useCallback((message, tipo = 'ok') => {
    clearTimeout(timer.current)
    setToast({ message, tipo })
    timer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const value = useMemo(() => show, [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div role="status" className={`ag-toast ag-toast--${toast.tipo}`}>
          <span className="ag-toast__dot" />
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  )
}

/** Returns `toast(message, tipo)`. */
export function useToast() {
  return useContext(ToastContext)
}
