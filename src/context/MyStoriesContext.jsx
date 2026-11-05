import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import useConnectivity from '../hooks/useConnectivity.js'
import { cacheDelete, cacheGet, cacheSet } from '../offline/store.js'
import { OfflineError } from '../services/http.js'
import { fetchMyStories } from '../services/stories.js'
import { useAuth } from './AuthContext.jsx'
import { useOutbox } from './OutboxContext.jsx'

/**
 * The signed-in narrator's own stories (F10, F6): the list in "Mis historias" and the counter in the menu.
 * It joins what the server has with the drafts kept on the phone while there is no signal (state "borrador"), and marks
 * the stories whose video is still on the phone (`video_pendiente`: it is sent after the story, F13).
 * Loads when a narrator is signed in and again when the signal returns; each person only ever sees their own.
 *
 * status (of the server's list): loading | ready | offline (never loaded and no signal) | error.
 * A failed refresh keeps showing the last list, and so does opening the app without signal: the last list
 * is kept on the phone while the person stays signed in.
 */

const MyStoriesContext = createContext({ stories: null, drafts: 0, status: 'loading', reload: () => Promise.resolve() })

const cacheKey = (narratorId) => `mias:${narratorId}`

/** A draft kept on the phone, shaped like a story of the server so the list can show both. */
function draftAsStory(item) {
  return {
    clientId: item.clientId,
    codigo: null, // the server assigns the code when the story arrives
    titulo: item.titulo,
    sector_id: item.location?.sectorId ?? null,
    lugar_nombre: item.lugar || null,
    lugar_texto: item.lugarTexto ?? null, // the place as the narrator saw it, for a phone that has not loaded the sectors
    epoca: item.epoca,
    formatos: item.formatos,
    estado: 'borrador',
    motivo_rechazo: null,
    enviada_en: item.guardadoEn,
    fallo: item.fallo ?? null,
  }
}

export function MyStoriesProvider({ children }) {
  const { user } = useAuth()
  const { online } = useConnectivity()
  const { items, sentVersion, progress } = useOutbox()
  const [state, setState] = useState({ stories: null, status: 'loading' })
  const narratorId = user?.rol === 'narrador' ? user.id : null
  const activeId = useRef(narratorId)
  const pending = useRef(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const reload = useCallback(() => {
    if (!narratorId) return Promise.resolve()
    if (pending.current) return pending.current // one request at a time
    const settle = (next) => {
      if (mounted.current && activeId.current === narratorId) setState(next) // not after the page is gone, nor if another person signed in meanwhile
    }
    const request = fetchMyStories()
      .then((stories) => {
        settle({ stories, status: 'ready' })
        if (mounted.current && activeId.current === narratorId) cacheSet(cacheKey(narratorId), stories)
      })
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

  // A different person (or nobody) starts from a clean list, and the previous one's copy leaves the phone.
  useEffect(() => {
    if (activeId.current === narratorId) return
    if (activeId.current) cacheDelete(cacheKey(activeId.current))
    activeId.current = narratorId
    pending.current = null
    setState({ stories: null, status: 'loading' })
  }, [narratorId])

  // The last list the server gave, while the first answer of this visit has not come.
  useEffect(() => {
    if (!narratorId) return undefined
    let cancelled = false
    cacheGet(cacheKey(narratorId)).then((stories) => {
      if (!cancelled && stories) setState((current) => (current.stories ? current : { ...current, stories }))
    })
    return () => {
      cancelled = true
    }
  }, [narratorId])

  useEffect(() => {
    if (!narratorId) return
    if (online) reload()
    else setState((current) => (current.stories ? current : { stories: null, status: 'offline' }))
  }, [narratorId, online, reload])

  // A draft just went to the server: it is now one of the server's stories.
  useEffect(() => {
    if (sentVersion > 0) reload()
  }, [sentVersion, reload])

  // Items in the "video" phase are not drafts: their story is already on the server, only its video is still on the phone.
  const drafts = useMemo(() => items.filter((item) => item.fase !== 'video').map(draftAsStory), [items])
  const waitingVideos = useMemo(() => new Map(items.filter((item) => item.fase === 'video').map((item) => [item.codigo, item])), [items])
  const stories = useMemo(() => {
    if (!state.stories && drafts.length === 0) return null
    const server = (state.stories ?? []).map((story) => {
      const video = waitingVideos.get(story.codigo)
      return video ? { ...story, video_pendiente: { clientId: video.clientId, titulo: video.titulo, fallo: video.fallo ?? null, progreso: progress[video.clientId] ?? null } } : story
    })
    return [...drafts, ...server]
  }, [state.stories, drafts, waitingVideos, progress])
  const value = useMemo(
    () => ({ stories, drafts: drafts.length, status: state.status, reload }),
    [stories, drafts.length, state.status, reload],
  )
  return <MyStoriesContext.Provider value={value}>{children}</MyStoriesContext.Provider>
}

export function useMyStories() {
  return useContext(MyStoriesContext)
}
