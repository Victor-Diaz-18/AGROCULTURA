import { useEffect, useRef } from 'react'
import { useOutbox } from '../../context/OutboxContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import useConnectivity from '../../hooks/useConnectivity.js'

/** Tells the person when the signal is lost or comes back (real or simulated), as the design does. */
export default function ConnectivityToasts() {
  const { online } = useConnectivity()
  const { waiting } = useOutbox()
  const toast = useToast()
  const previous = useRef(online)
  const waitingNow = useRef(waiting)
  waitingNow.current = waiting

  useEffect(() => {
    if (previous.current === online) return
    previous.current = online
    if (!online) toast('Sin señal: lo que cuentes se guarda en el dispositivo.', 'info')
    else if (waitingNow.current === 0) toast('Volvió la señal.') // with stories waiting, sending them says it (and the signal) itself
  }, [online, toast])

  return null
}
