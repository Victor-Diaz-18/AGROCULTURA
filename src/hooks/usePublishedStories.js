import { useCallback, useEffect, useRef, useState } from 'react'
import { cacheGet, cacheSet } from '../offline/store.js'
import { OfflineError } from '../services/http.js'
import { fetchPublishedStories } from '../services/stories.js'
import useConnectivity from './useConnectivity.js'

/**
 * The published stories the map draws (F1). It asks when the page opens and again when the signal returns,
 * and keeps the last list while a new one is on its way or fails. The last list is also kept on the phone, so the map
 * opens with the stories already seen even without signal (F10).
 * status: loading | ready | offline (never loaded, no signal) | error.
 */
export default function usePublishedStories() {
  const { online } = useConnectivity()
  const [state, setState] = useState({ stories: [], status: 'loading' })
  const fresh = useRef(false) // the server already answered: the saved copy is older
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const stories = await fetchPublishedStories()
      fresh.current = true
      setState({ stories, status: 'ready' })
      if (mounted.current) cacheSet('publicadas', stories)
    } catch (error) {
      setState((current) =>
        current.status === 'ready' ? current : { stories: current.stories, status: error instanceof OfflineError ? 'offline' : 'error' },
      )
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    cacheGet('publicadas').then((saved) => {
      if (cancelled || fresh.current || !saved) return
      setState((current) => (current.status === 'ready' ? current : { ...current, stories: saved }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (online) load()
    else setState((current) => (current.status === 'ready' ? current : { stories: current.stories, status: 'offline' }))
  }, [online, load])

  return { ...state, reload: load }
}
