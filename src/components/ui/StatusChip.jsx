import { ESTADOS } from '../../config/constants.js'

/** State pill: borrador, revision, publicada or rechazada. `audience` picks the wording. */
export default function StatusChip({ estado, audience = 'narrador' }) {
  const info = ESTADOS[estado]
  if (!info) return null
  return (
    <span className={`ag-status ag-status--${estado}`}>
      <span className="ag-status__dot" />
      {audience === 'admin' ? info.labelAdmin : info.label}
    </span>
  )
}
