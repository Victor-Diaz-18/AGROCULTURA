import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../../utils/format.js'
import { SHOW_CODES } from '../../config/flags.js'
import Icon from '../ui/Icon.jsx'

/**
 * The dark audio card of the design (F5). `seconds` is the length the story says it has: recordings made in the
 * browser (webm) often report no length of their own, so it is preferred over what the file says.
 * Without `url` (the example stories have no real file) the button is off and says so.
 */
export default function AudioPlayer({ url, seconds = 0, title = 'Audio del narrador' }) {
  const player = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [reported, setReported] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setPlaying(false)
    setPosition(0)
    setFailed(false)
  }, [url])

  const length = seconds || (Number.isFinite(reported) ? reported : 0)
  const percent = length > 0 ? Math.min(100, (position / length) * 100) : 0

  const toggle = () => {
    const element = player.current
    if (!element) return
    if (playing) {
      element.pause()
      return
    }
    setFailed(false)
    Promise.resolve(element.play?.()).catch(() => {
      setPlaying(false)
      setFailed(true)
    })
  }

  return (
    <div className="ag-audio">
      {url && (
        <audio
          ref={player}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setPosition(0)
          }}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setReported(event.currentTarget.duration)}
          onError={() => setFailed(true)}
        />
      )}
      <button
        type="button"
        className="ag-audio__button"
        aria-label={playing ? 'Pausar' : 'Escuchar el audio'}
        onClick={toggle}
        disabled={!url}
      >
        <Icon name={playing ? 'pausa' : 'play'} size={20} />
      </button>
      <div className="ag-audio__body">
        <span className="ag-audio__title">
          {title}
          {SHOW_CODES ? ' · F5' : ''}
        </span>
        <div
          className="ag-audio__bar"
          role="progressbar"
          aria-label="Avance del audio"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div style={{ width: `${percent}%` }} />
        </div>
        <div className="ag-audio__time">
          <span>{formatDuration(position)}</span>
          <span>{formatDuration(length)}</span>
        </div>
        {!url && <span className="ag-audio__note">Historia de ejemplo: no tiene archivo de audio.</span>}
        {failed && (
          <span role="alert" className="ag-audio__note">
            No pudimos reproducir este audio.
          </span>
        )}
      </div>
    </div>
  )
}
