import { useEffect, useState } from 'react'

/** A temporary address to show or play a Blob (a photo or an audio) in the page; freed when it is no longer needed. */
export default function useObjectUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob || typeof URL.createObjectURL !== 'function') {
      setUrl(null)
      return undefined
    }
    const created = URL.createObjectURL(blob)
    setUrl(created)
    return () => URL.revokeObjectURL?.(created)
  }, [blob])
  return url
}
