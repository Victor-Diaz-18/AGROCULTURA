import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe, toggleSimulatedOffline } from '../offline/connectivity.js'

/** { online, realOnline, simulatedOffline, toggleSimulated } */
export default function useConnectivity() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { ...state, toggleSimulated: toggleSimulatedOffline }
}
