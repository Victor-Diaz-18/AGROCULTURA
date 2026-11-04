import { useEffect, useRef } from 'react'
import { useToast } from '../../context/ToastContext.jsx'
import useConnectivity from '../../hooks/useConnectivity.js'

/** Tells the person when the signal is lost or comes back (real or simulated), as the design does. */
export default function ConnectivityToasts() {
  const { online } = useConnectivity()
  const toast = useToast()
  const previous = useRef(online)

  useEffect(() => {
    if (previous.current === online) return
    previous.current = online
    if (online) toast('Volvió la señal.')
    else toast('Sin señal: lo que cuentes se guarda en el dispositivo.', 'info')
  }, [online, toast])

  return null
}
