import { useRef, useState } from 'react'
import { LIMITS } from '../../config/constants.js'
import useObjectUrl from '../../hooks/useObjectUrl.js'
import { compressImage } from '../../offline/media.js'
import { checkVideoFile } from '../../services/video.js'
import { formatBytes } from '../../utils/format.js'
import { newId } from '../../utils/id.js'
import Button from '../ui/Button.jsx'
import FCode from '../ui/FCode.jsx'
import Icon from '../ui/Icon.jsx'

/**
 * "Agregar foto" (F4) and, when `onAddVideo` is given, "Agregar video" (F13). Each photo is reduced on the phone
 * (see offline/media.js) before it is kept; a video is kept as it is (it cannot be reduced there) after checking its type
 * and that it is no more than 25 MB, since it goes up straight to Blob later.
 * photos: [{ id, name, blob }]. video: { id, name, blob, mime } or null: a story has one at most.
 */

export const PHOTO_MESSAGES = {
  limit: `Puedes agregar hasta ${LIMITS.fotos} fotos.`,
  unreadable: (name) => `No pudimos leer «${name}». Prueba con otra foto.`,
}

/** "video_01.mp4": the same friendly names the photos get. */
const videoName = (mime) => `video_01.${{ 'video/quicktime': 'mov', 'video/webm': 'webm' }[mime] ?? 'mp4'}`

function VideoChip({ video, onRemove }) {
  return (
    <li className="ag-attached__item">
      <b>Video</b>
      <span>
        {video.name} · {formatBytes(video.blob.size)}
      </span>
      <button type="button" className="ag-attached__remove" aria-label={`Quitar ${video.name}`} onClick={onRemove}>
        <Icon name="cerrar" size={14} strokeWidth={2.4} />
      </button>
    </li>
  )
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
export default function MediaPicker({ photos, nextName, onAdd, onRemove, video = null, onAddVideo, onRemoveVideo, heading = 'Fotos', children }) {
  const input = useRef(null)
  const videoInput = useRef(null)
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

  const pickVideo = (event) => {
    const file = event.target.files[0]
    event.target.value = '' // lets the person pick the same video again later
    if (!file) return
    const checked = checkVideoFile(file)
    if (checked.problem) {
      setProblem(checked.problem)
      return
    }
    setProblem('')
    onAddVideo({ id: newId(), name: videoName(checked.mime), blob: file, mime: checked.mime })
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
        {onAddVideo && (
          <>
            <Button variant="line" icon="video" onClick={() => videoInput.current?.click()} disabled={Boolean(video)}>
              <span>Agregar video</span>
              <FCode>F13</FCode>
            </Button>
            <input
              ref={videoInput}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              hidden
              aria-label="Elegir un video"
              onChange={pickVideo}
            />
          </>
        )}
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
      {(photos.length > 0 || video) && (
        <ul className="ag-attached" aria-label={onAddVideo ? 'Fotos y video agregados' : 'Fotos agregadas'}>
          {photos.map((photo) => (
            <PhotoChip key={photo.id} photo={photo} onRemove={onRemove} />
          ))}
          {video && <VideoChip video={video} onRemove={onRemoveVideo} />}
        </ul>
      )}
    </div>
  )
}
