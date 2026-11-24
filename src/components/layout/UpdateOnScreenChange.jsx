import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { screenChanged } from '../../offline/updates.js'

/**
 * New versions come in by themselves, nobody is asked (src/offline/updates.js). Moving to another screen is one of the
 * moments when a reload loses nothing, so this tells the updates every time the screen changes. Shows nothing.
 */
export default function UpdateOnScreenChange() {
  const { pathname } = useLocation()
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false // the screen the app opened on is not a change
      return
    }
    screenChanged()
  }, [pathname])

  return null
}
