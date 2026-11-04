import { useSyncExternalStore } from 'react'
import { applyUpdate, getSnapshot, subscribe } from '../offline/updates.js'

/** { available, apply }: is a new version of the app waiting, and the way to switch to it. */
export default function useAppUpdate() {
  const { available } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { available, apply: applyUpdate }
}
