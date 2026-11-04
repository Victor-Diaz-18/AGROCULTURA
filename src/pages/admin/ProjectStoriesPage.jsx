import PageHeader from '../../components/layout/PageHeader.jsx'
import PendingBlock from '../../components/layout/PendingBlock.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'

const TEXT = {
  portal: 'Las sube el equipo. En el mapa se ven en otro color para distinguirlas de las de la comunidad.',
  admin: 'Las sube el equipo y se publican de una vez. En el mapa salen en otro color.',
}

/** Stories uploaded by the team (F12). Shared by the portal and the admin panel. */
export default function ProjectStoriesPage({ variant = 'portal' }) {
  return (
    <>
      <PageHeader
        title="Historias del proyecto"
        subtitle={TEXT[variant]}
        actions={variant === 'portal' ? <ListenButton title="Historias del proyecto" text={`Historias del proyecto. ${TEXT.portal}`} /> : null}
      />
      <PendingBlock block={4}>La lista y el formulario «Nueva historia del proyecto» se construyen en el bloque 4 (F12).</PendingBlock>
    </>
  )
}
