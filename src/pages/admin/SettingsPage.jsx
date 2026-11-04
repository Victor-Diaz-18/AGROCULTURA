import PageHeader from '../../components/layout/PageHeader.jsx'
import PendingBlock from '../../components/layout/PendingBlock.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'

const TEXT = {
  portal: 'Lo que puede cambiar el administrador (F7).',
  admin: 'Ajustes que solo puede cambiar un administrador.',
}

/** Portal settings: name, moderation, sectors, tags (F7). Shared by the portal and the admin panel. */
export default function SettingsPage({ variant = 'portal' }) {
  return (
    <>
      <PageHeader
        title="Configuración del portal"
        subtitle={TEXT[variant]}
        actions={variant === 'portal' ? <ListenButton title="Configuración del portal" text={`Configuración del portal. ${TEXT.portal}`} /> : null}
      />
      <PendingBlock block={4}>Las opciones del portal, los sectores y las etiquetas se construyen en el bloque 4 (F7).</PendingBlock>
    </>
  )
}
