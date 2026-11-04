import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import useConnectivity from '../hooks/useConnectivity.js'
import { OfflineError } from '../services/http.js'
import { fetchMyStories } from '../services/stories.js'
import { useAuth } from './AuthContext.jsx'

/**
 * The signed-in narrator's own stories (F10, F6): the list in "Mis historias" and the counter in the menu.
 * Loads when a narrator is signed in and again when the signal returns; each person only ever sees their own.
 *
 * status: loading | ready | offline (never loaded and no signal) | error.
 * A failed refresh keeps showing the last list. Block 6 adds the drafts kept on the phone.
 */

const MyStoriesContext = createContext({ stories: null, status: 'loading', reload: () => Promise.resolve() })

export function MyStoriesProvider({ children }) {
  const { user } = useAuth()
  const { online } = useConnectivity()
  const [state, setState] = useState({ stories: null, status: 'loading' })
  const narratorId = user?.rol === 'narrador' ? user.id : null
  const activeId = useRef(narratorId)
  const pending = useRef(null)

  const reload = useCallback(() => {
    if (!narratorId) return Promise.resolve()
    if (pending.current) return pending.current // one request at a time
    const settle = (next) => {
      if (activeId.current === narratorId) setState(next) // another person may have signed in meanwhile
    }
    const request = fetchMyStories()
      .then((stories) => settle({ stories, status: 'ready' }))
      .catch((error) =>
        settle((current) =>
          current.stories ? current : { stories: null, status: error instanceof OfflineError ? 'offline' : 'error' },
        ),
      )
      .finally(() => {
        if (pending.current === request) pending.current = null
      })
    pending.current = request
    return request
  }, [narratorId])

  // A different person (or nobody) starts from a clean list.
  useEffect(() => {
    if (activeId.current === narratorId) return
    activeId.current = narratorId
    pending.current = null
    setState({ stories: null, status: 'loading' })
  }, [narratorId])

  useEffect(() => {
    if (!narratorId) return
    if (online) reload()
    else setState((current) => (current.stories ? current : { stories: null, status: 'offline' }))
  }, [narratorId, online, reload])

  const value = useMemo(() => ({ ...state, reload }), [state, reload])
  return <MyStoriesContext.Provider value={value}>{children}</MyStoriesContext.Provider>
}

export function useMyStories() {
  return useContext(MyStoriesContext)
}
