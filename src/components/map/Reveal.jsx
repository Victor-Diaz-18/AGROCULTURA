import { useEffect, useRef, useState } from 'react'

/** True while the element is on screen (or if the browser cannot tell, so nothing ever stays hidden or stopped). */
export function useInView(ref, { once = false } = {}) {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !ref.current) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
        if (entry.isIntersecting && once) observer.disconnect()
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref, once])
  return inView
}

/** An element that rises softly the first time it comes into view. */
export default function Reveal({ as: Tag = 'div', className = '', children, ...props }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return (
    <Tag ref={ref} className={`${className} ${inView ? 'ag-reveal--shown' : 'ag-reveal--waiting'}`.trim()} {...props}>
      {children}
    </Tag>
  )
}
