import { useRef, useState } from 'react'
import { LIMITS } from '../../config/constants.js'
import useObjectUrl from '../../hooks/useObjectUrl.js'
import { compressImage } from '../../offline/media.js'
import { formatBytes } from '../../utils/format.js'
import { newId } from '../../utils/id.js'
import Button from '../ui/Button.jsx'
import FCode from '../ui/FCode.jsx'
import Icon from '../ui/Icon.jsx'

/**
 * "Agregar foto" (F4). Each photo is reduced on the phone (see offline/media.js) before it is kept.
 * photos: [{ id, name, blob }]. The video button arrives in block 7 (F13).
 */

export const PHOTO_MESSAGES = {
  limit: `Puedes agregar hasta ${LIMITS.fotos} fotos.`,
  unreadable: (name) => `No pudimos leer «${name}». Prueba con otra foto.`,
}

function PhotoChip({ photo, onRemove }) {
  const url = useObjectUrl(photo.blob)
  return (
    <li className="ag-attached__item">
      {url && <img className="ag-attached__thumb" src={url} alt="" />}
      <b>Foto</b>
      <span>
        {photo.name} · {formatBytes(photo.blob.size)}
      </span>
      <button type="button" className="ag-attached__remove" aria-label={`Quitar ${photo.name}`} onClick={() => onRemove(photo.id)}>
        <Icon name="cerrar" size={14} strokeWidth={2.4} />
      </button>
    </li>
  )
}

/** `heading`: the title above the buttons (null hides it). `children`: more buttons for the same row (e.g. "Agregar audio"). */
export default function MediaPicker({ photos, nextName, onAdd, onRemove, heading = 'Fotos', children }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  const pick = async (event) => {
    const files = [...event.target.files]
    event.target.value = '' // lets the person pick the same photo again later
    if (files.length === 0) return
    setProblem('')
    setBusy(true)
    const added = []
    const problems = []
    for (const file of files) {
      if (photos.length + added.length >= LIMITS.fotos) {
        problems.push(PHOTO_MESSAGES.limit)
        break
      }
      try {
        const blob = await compressImage(file)
        added.push({ id: newId(), name: nextName(), blob })
      } catch {
        problems.push(PHOTO_MESSAGES.unreadable(file.name))
      }
    }
    if (added.length > 0) onAdd(added)
    setProblem(problems.join(' '))
    setBusy(false)
  }

  return (
    <div className="ag-tell__block ag-tell__block--wide">
      {heading && <div className="ag-tell__label">{heading}</div>}
      <div className="ag-attach">
        <Button variant="line" icon="camara" onClick={() => input.current?.click()} disabled={busy || photos.length >= LIMITS.fotos}>
          <span>Agregar foto</span>
          <FCode>F4</FCode>
        </Button>
        <input ref={input} type="file" accept="image/*" multiple hidden aria-label="Elegir fotos" onChange={pick} />
        {children}
      </div>
      {busy && (
        <p role="status" className="ag-hint">
          Preparando tus fotos…
        </p>
      )}
      {problem && (
        <p role="alert" className="ag-error">
          {problem}
        </p>
      )}
      {photos.length > 0 && (
        <ul className="ag-attached" aria-label="Fotos agregadas">
          {photos.map((photo) => (
            <PhotoChip key={photo.id} photo={photo} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </div>
  )
}
