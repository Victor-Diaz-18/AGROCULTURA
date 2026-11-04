import { useEffect, useRef, useState } from 'react'
import useObjectUrl from '../../hooks/useObjectUrl.js'
import { MESSAGES } from '../../hooks/useRecorder.js'
import { formatDuration } from '../../utils/format.js'
import Icon from '../ui/Icon.jsx'

/**
 * Voice recorder of "Contar una historia" (F5). It only shows state; the recording itself
 * lives in the page (useRecorder), so it keeps going if the person moves to the next step.
 *
 * audio: { blob, seconds } once a recording exists.
 */

// The prototype's bars, drawn once (not animated).
const WAVE = [
  [0, 10, 8], [14, 5, 18], [28, 1, 26], [42, 8, 12], [56, 3, 22], [70, 9, 10], [84, 0, 28], [98, 6, 16], [112, 2, 24], [126, 8, 12],
  [140, 4, 20], [154, 10, 8], [168, 3, 22], [182, 7, 14], [196, 1, 26], [210, 9, 10], [224, 5, 18], [238, 11, 6], [252, 6, 16], [266, 10, 8],
]

function Wave() {
  return (
    <svg className="ag-rec__wave" viewBox="0 0 300 28" preserveAspectRatio="none" aria-hidden="true">
      <g fill="#E39AA2">
        {WAVE.map(([x, y, height]) => (
          <rect key={x} x={x} y={y} width="6" height={height} rx="3" />
        ))}
        <rect x="280" y="12" width="6" height="4" rx="2" />
      </g>
    </svg>
  )
}

/** "Oír mi audio": lets the person check the recording before sending it. */
function Listen({ blob }) {
  const url = useObjectUrl(blob)
  const player = useRef(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => setPlaying(false), [url])
  if (!url) return null

  const toggle = () => {
    const element = player.current
    if (!element) return
    if (playing) {
      element.pause()
      setPlaying(false)
      return
    }
    setPlaying(true)
    Promise.resolve(element.play?.()).catch(() => setPlaying(false))
  }

  return (
    <>
      <audio ref={player} src={url} onEnded={() => setPlaying(false)} preload="auto" />
      <button type="button" className="ag-rec__btn ag-rec__btn--listen" onClick={toggle}>
        {playing ? 'Parar' : 'Oír mi audio'}
      </button>
    </>
  )
}

export default function AudioRecorder({ status, seconds, audio, error, notice, supported, onDevice = true, onStart, onStop, onRemove }) {
  const recording = status === 'recording'
  const problem = error || (!supported ? MESSAGES.unsupported : '')

  return (
    <div className="ag-rec">
      {recording ? (
        <>
          <button type="button" className="ag-rec__big" aria-label="Terminar de grabar" onClick={onStop}>
            <Icon name="detener" size={26} />
          </button>
          <div className="ag-rec__text ag-rec__text--live">
            <span className="ag-rec__title ag-rec__title--live">Grabando… {formatDuration(seconds)}</span>
            <Wave />
            <span className="ag-rec__note">Toca el botón cuando termines.</span>
          </div>
        </>
      ) : audio ? (
        <>
          <span className="ag-rec__done" aria-hidden="true">
            <Icon name="check" size={30} strokeWidth={2.6} />
          </span>
          <div className="ag-rec__text">
            <span className="ag-rec__title">Audio grabado · {formatDuration(audio.seconds)}</span>
            <span className="ag-rec__note">
              {onDevice ? 'Se guarda en este dispositivo hasta que la envíes.' : 'Se queda en esta página hasta que la envíes.'}
            </span>
          </div>
          <div className="ag-rec__actions">
            <Listen blob={audio.blob} />
            <button type="button" className="ag-rec__btn ag-rec__btn--again" onClick={onStart} disabled={!supported}>
              Grabar de nuevo
            </button>
            <button type="button" className="ag-rec__btn" onClick={onRemove}>
              Quitar
            </button>
          </div>
        </>
      ) : (
        <>
          <button type="button" className="ag-rec__big" aria-label="Grabar tu historia" onClick={onStart} disabled={!supported}>
            <Icon name="mic" size={30} />
          </button>
          <div className="ag-rec__text">
            <span className="ag-rec__title">Toca para grabar</span>
            <span className="ag-rec__note">
              Habla con calma, como si se la contaras a un vecino. Si no te gusta, puedes grabar de nuevo.
            </span>
          </div>
        </>
      )}
      {problem && (
        <p role="alert" className="ag-error ag-rec__problem">
          {problem}
        </p>
      )}
      {notice && (
        <p role="status" className="ag-hint ag-rec__problem">
          {notice}
        </p>
      )}
    </div>
  )
}
