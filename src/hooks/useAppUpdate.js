import { useSyncExternalStore } from 'react'
import { applyUpdate, getSnapshot, subscribe } from '../offline/updates.js'

/** { available, applying, slow, apply }: is a new version waiting, is the switch under way (and taking long), and the way to switch. */
export default function useAppUpdate() {
  const { available, applying, slow } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { available, applying, slow, apply: applyUpdate }
}
