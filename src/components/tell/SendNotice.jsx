import FCode from '../ui/FCode.jsx'
import Icon from '../ui/Icon.jsx'

/**
 * Green with signal, yellow without (F10).
 * Block 3 sends only with a connection; block 6 changes the offline wording to "se guarda y se envía sola".
 */
export default function SendNotice({ online }) {
  return (
    <div className={`ag-signal${online ? '' : ' ag-signal--off'}`}>
      <Icon name={online ? 'wifi' : 'wifi-off'} size={22} />
      <div className="ag-signal__text">
        <b>{online ? 'Hay señal' : 'Sin señal'}</b>
        <span>
          {online
            ? 'Se envía ahora y un administrador la revisa antes de publicarla.'
            : 'Para enviarla necesitas señal. Tu historia sigue aquí: cuando vuelva la señal, toca «Enviar historia».'}
        </span>
      </div>
      <FCode>F10</FCode>
    </div>
  )
}
