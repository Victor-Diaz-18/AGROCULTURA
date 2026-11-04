import { useEffect } from 'react'
import { usePortalData } from '../context/PortalDataContext.jsx'

/** The title of the browser tab, and what a screen reader says when the page opens: "Mis historias · AGROCULTURA". */
export default function usePageTitle(title) {
  const { config } = usePortalData()
  const name = config.portal.nombre
  useEffect(() => {
    document.title = title ? `${title} · ${name}` : name
  }, [title, name])
}
