import PageHeader from '../../components/layout/PageHeader.jsx'
import PendingBlock from '../../components/layout/PendingBlock.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'

const TEXT = {
  portal: 'Ninguna historia se publica sin pasar por aquí. Revisa el contenido, márcalo y decide.',
  admin: 'Ninguna historia de la comunidad se publica sin pasar por aquí.',
}

/** Review queue (F6). Shared by the portal ("portal") and the admin panel ("admin"). */
export default function ReviewPage({ variant = 'portal' }) {
  return (
    <>
      <PageHeader
        title="Revisión de historias"
        subtitle={TEXT[variant]}
        actions={variant === 'portal' ? <ListenButton title="Revisión de historias" text={`Revisión de historias. ${TEXT.portal}`} /> : null}
      />
      <PendingBlock block={4}>La bandeja de revisión se construye en el bloque 4 (F6, F7).</PendingBlock>
    </>
  )
}
