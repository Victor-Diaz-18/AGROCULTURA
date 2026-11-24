import { useToast } from '../../context/ToastContext.jsx'
import Button from '../ui/Button.jsx'

/**
 * The address of a published story to share. The server answers it with the story's title, text and photo, which is what
 * WhatsApp and the other apps show when the link is pasted (lib/stories/share.py); whoever opens it lands on the story.
 */
export const shareUrl = (codigo) => `${window.location.origin}/h/${encodeURIComponent(codigo)}`

const MESSAGE = 'Mira esta historia de la cultura cafetera de Minca:'

/**
 * «Compartir»: on a phone it opens the list of apps (WhatsApp, Facebook…). Where there is none (most computers) it copies the
 * link to paste it anywhere, and if even that is not allowed it opens WhatsApp with the link written.
 */
export default function ShareButton({ story, size = 'md' }) {
  const toast = useToast()

  const onClick = async () => {
    const url = shareUrl(story.codigo)
    if (navigator.share) {
      try {
        await navigator.share({ title: story.titulo, text: MESSAGE, url })
        return
      } catch (error) {
        if (error?.name === 'AbortError') return // the person closed the list of apps
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast('Enlace copiado. Pégalo en WhatsApp o donde quieras compartirlo.')
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${MESSAGE} ${url}`)}`, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Button variant="outline" size={size} icon="compartir" onClick={onClick}>
      Compartir
    </Button>
  )
}
