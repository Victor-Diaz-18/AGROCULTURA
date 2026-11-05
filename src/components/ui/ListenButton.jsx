import { usePortalData } from '../../context/PortalDataContext.jsx'
import { useSpeech } from '../../context/SpeechContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import Button from './Button.jsx'

/**
 * The "Escuchar" button every page has (F9). `text` is what is read aloud; it can be a function so the page reads its
 * latest content on each click. `piece` names public content the server can read with the voice of the portal
 * ("portada", "fincas", "historias/HIS-2026-001"); without it, or when that voice is not set up, the device's voice reads.
 */
export default function ListenButton({ title, text, piece, label = 'Escuchar', size = 'md' }) {
  const { speak } = useSpeech()
  const { config } = usePortalData()
  const toast = useToast()

  const onClick = () => {
    const content = typeof text === 'function' ? text() : text
    if (!speak(title, content, config.voz_disponible ? piece : undefined)) toast('Este dispositivo no puede leer en voz alta.', 'info')
  }

  return (
    <Button variant="outline" size={size} icon="altavoz" onClick={onClick}>
      {label}
    </Button>
  )
}
