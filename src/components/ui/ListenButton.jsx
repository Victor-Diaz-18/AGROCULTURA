import { useSpeech } from '../../context/SpeechContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import Button from './Button.jsx'

/**
 * The "Escuchar" button every page has (F9). `text` is what is read aloud;
 * it can be a function so the page reads its latest content on each click.
 */
export default function ListenButton({ title, text, label = 'Escuchar', size = 'md' }) {
  const { speak } = useSpeech()
  const toast = useToast()

  const onClick = () => {
    const content = typeof text === 'function' ? text() : text
    if (!speak(title, content)) toast('Este dispositivo no puede leer en voz alta.', 'info')
  }

  return (
    <Button variant="outline" size={size} icon="altavoz" onClick={onClick}>
      {label}
    </Button>
  )
}
