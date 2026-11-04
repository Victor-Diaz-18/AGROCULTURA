import { useCallback, useEffect, useState } from 'react'
import { OfflineError } from '../services/http.js'
import { fetchPublishedStories } from '../services/stories.js'
import useConnectivity from './useConnectivity.js'

/**
 * The published stories the map draws (F1). It asks when the page opens and again when the signal returns,
 * and keeps the last list while a new one is on its way or fails.
 * status: loading | ready | offline (never loaded, no signal) | error.
 */
export default function usePublishedStories() {
  const { online } = useConnectivity()
  const [state, setState] = useState({ stories: [], status: 'loading' })

  const load = useCallback(async () => {
    try {
      setState({ stories: await fetchPublishedStories(), status: 'ready' })
    } catch (error) {
      setState((current) =>
        current.status === 'ready' ? current : { stories: current.stories, status: error instanceof OfflineError ? 'offline' : 'error' },
      )
    }
  }, [])

  useEffect(() => {
    if (online) load()
    else setState((current) => (current.status === 'ready' ? current : { stories: current.stories, status: 'offline' }))
  }, [online, load])

  return { ...state, reload: load }
}
