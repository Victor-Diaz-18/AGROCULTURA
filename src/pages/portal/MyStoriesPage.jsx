import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader.jsx'
import PendingBlock from '../../components/layout/PendingBlock.jsx'
import Button from '../../components/ui/Button.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'

const READ_ALOUD = 'Mis historias. Lo que has contado y en qué va cada historia.'

/** The narrator's own stories with their state (F10, F6). Built in blocks 3 and 6. */
export default function MyStoriesPage() {
  const navigate = useNavigate()
  return (
    <>
      <PageHeader
        title="Mis historias"
        subtitle="Lo que has contado y en qué va cada historia."
        actions={
          <>
            <ListenButton title="Mis historias" text={READ_ALOUD} />
            <Button variant="primary" icon="mas" onClick={() => navigate('/contar')}>
              Contar otra historia
            </Button>
          </>
        }
      />
      <PendingBlock block={3}>La lista de tus historias y su estado se construye junto con el envío (bloques 3 y 6).</PendingBlock>
    </>
  )
}
