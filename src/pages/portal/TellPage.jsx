import PageHeader from '../../components/layout/PageHeader.jsx'
import PendingBlock from '../../components/layout/PendingBlock.jsx'
import ListenButton from '../../components/ui/ListenButton.jsx'

const READ_ALOUD =
  'Contar una historia. Con tu voz, una foto, un video o por escrito. Nadie la ve hasta que un administrador la aprueba.'

/** Tell a story in three steps (F3, F4, F5, F13). Built in block 3. */
export default function TellPage() {
  return (
    <>
      <PageHeader
        title="Contar una historia"
        subtitle="Con tu voz, una foto, un video o por escrito. Nadie la ve hasta que un administrador la aprueba."
        actions={<ListenButton title="Contar una historia" text={READ_ALOUD} label="Escuchar instrucciones" />}
      />
      <PendingBlock block={3}>Los tres pasos para contar una historia se construyen en el bloque 3 (F3, F4, F5).</PendingBlock>
    </>
  )
}
