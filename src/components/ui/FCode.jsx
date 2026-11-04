import { SHOW_CODES } from '../../config/flags.js'

/** The small monospace feature code (F1, F2, ...) used in the approved design. */
export default function FCode({ children, className = '' }) {
  if (!SHOW_CODES) return null
  return <span className={`ag-fcode ${className}`.trim()}>{children}</span>
}
