import { LIMITS } from '../../config/constants.js'
import FCode from '../ui/FCode.jsx'
import AudioRecorder from './AudioRecorder.jsx'
import MediaPicker from './MediaPicker.jsx'

/** Step 1, "Cuéntala": voice (F5), writing (F3) and photos (F4). */
export default function StepRecord({ recorder, audio, onStartRecording, onRemoveAudio, texto, onTexto, photos, onDevice = true }) {
  return (
    <>
      <div className="ag-tell__block">
        <div className="ag-tell__row">
          <span className="ag-tell__label">Grábala con tu voz</span>
          <FCode>F5</FCode>
        </div>
        <AudioRecorder
          status={recorder.status}
          seconds={recorder.seconds}
          error={recorder.error}
          notice={recorder.notice}
          supported={recorder.supported}
          audio={audio}
          onDevice={onDevice}
          onStart={onStartRecording}
          onStop={recorder.stop}
          onRemove={onRemoveAudio}
        />
      </div>

      <div className="ag-tell__block">
        <div className="ag-tell__row">
          <label htmlFor="ag-texto" className="ag-tell__label">
            O escríbela
          </label>
          <FCode>F3</FCode>
        </div>
        <textarea
          id="ag-texto"
          className="ag-tell__textarea"
          value={texto}
          maxLength={LIMITS.textoMax}
          onChange={(event) => onTexto(event.target.value)}
          placeholder="Cuenta qué pasó, quiénes estaban y por qué es importante para tu familia."
        />
      </div>

      <MediaPicker {...photos} />
    </>
  )
}
