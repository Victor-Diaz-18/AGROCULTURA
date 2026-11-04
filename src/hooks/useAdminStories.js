import { useCallback, useEffect, useRef, useState } from 'react'
import { OfflineError } from '../services/http.js'
import { fetchAdminStories } from '../services/admin.js'
import useConnectivity from './useConnectivity.js'

/**
 * A list of stories for the administrators (the review queue, the approved ones...).
 * `filters`: { estado, origen, limite }. status: loading | ready | offline | error.
 * `reload()` asks again and resolves when the new list is in place.
 */
export default function useAdminStories(filters) {
  const { online } = useConnectivity()
  const [state, setState] = useState({ stories: null, status: 'loading' })
  const latest = useRef(0)
  const key = JSON.stringify(filters)

  const load = useCallback(async () => {
    const mine = ++latest.current // an answer to an older filter (another tab) must not overwrite this one
    try {
      const stories = await fetchAdminStories(JSON.parse(key))
      if (mine === latest.current) setState({ stories, status: 'ready' })
    } catch (error) {
      if (mine !== latest.current) return
      setState((current) => ({ stories: current.stories, status: error instanceof OfflineError ? 'offline' : 'error' }))
    }
  }, [key])

  useEffect(() => {
    setState({ stories: null, status: 'loading' })
    if (online) load()
    else setState({ stories: null, status: 'offline' })
  }, [load, online])

  return { stories: state.stories ?? [], status: state.status, reload: load }
}
