import { useSyncExternalStore } from 'react'
import { applyUpdate, getSnapshot, subscribe } from '../offline/updates.js'

/** { available, applying, failed, apply }: is a new version waiting, is the switch under way, did it fail (no signal), and the way to switch. */
export default function useAppUpdate() {
  const { available, applying, failed } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { available, applying, failed, apply: applyUpdate }
}
