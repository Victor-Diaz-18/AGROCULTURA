import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * When the person moves to another page of the app, the heading of the new page takes the focus: a screen reader
 * says "Mis historias" and the keyboard continues from there instead of from the top of the menu. The first page of
 * a visit is left alone (the browser already announces it), and so is a change that only adds a query (a filter).
 */
export default function useFocusOnNavigation() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    document.querySelector('main h1')?.focus({ preventScroll: true })
  }, [pathname])
}
