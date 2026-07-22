import { useState, useCallback, useEffect, useRef } from 'react'

export function useViewportSize(ref) {
  const [size, setSize] = useState(() => {
    const el = ref?.current
    return {
      width: el ? el.clientWidth : window.innerWidth,
      height: el ? el.clientHeight : window.innerHeight,
    }
  })
  const rafRef = useRef(null)

  const measure = useCallback(() => {
    const el = ref?.current ?? document.documentElement
    const w = el.clientWidth
    const h = el.clientHeight
    setSize(prev => (prev.width !== w || prev.height !== h) ? { width: w, height: h } : prev)
  }, [ref])

  useEffect(() => {
    const el = ref?.current ?? document.documentElement
    if (!el) return

    measure()

    const handleResize = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measure)
    }

    const ro = new ResizeObserver(handleResize)
    ro.observe(el)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
    }
  }, [ref, measure])

  return size
}
