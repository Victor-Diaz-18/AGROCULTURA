import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe } from '../offline/connectivity.js'

/** { online, realOnline, simulatedOffline } */
export default function useConnectivity() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
