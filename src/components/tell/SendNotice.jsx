import FCode from '../ui/FCode.jsx'
import Icon from '../ui/Icon.jsx'

/** Green with signal, yellow without (F10): without signal the story is kept on the phone and goes out by itself. */
export default function SendNotice({ online }) {
  return (
    <div className={`ag-signal${online ? '' : ' ag-signal--off'}`}>
      <Icon name={online ? 'wifi' : 'wifi-off'} size={22} />
      <div className="ag-signal__text">
        <b>{online ? 'Hay señal' : 'Sin señal'}</b>
        <span>
          {online
            ? 'Se envía ahora y un administrador la revisa antes de publicarla.'
            : 'Se guarda en el dispositivo y se envía sola cuando vuelva la señal.'}
        </span>
      </div>
      <FCode>F10</FCode>
    </div>
  )
}
