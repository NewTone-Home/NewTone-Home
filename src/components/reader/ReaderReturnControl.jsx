import { useEffect, useRef, useState } from 'react'
import './ReaderReturnControl.css'

function ReaderReturnControl({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const [completing, setCompleting] = useState(false)
  const targetRef = useRef(0)
  const progressRef = useRef(0)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const completedRef = useRef(false)

  useEffect(() => {
    const animate = time => {
      const delta = lastTimeRef.current ? Math.min(40, time - lastTimeRef.current) : 16
      lastTimeRef.current = time
      const speed = targetRef.current > progressRef.current ? delta / 1750 : delta / 460
      const next = targetRef.current > progressRef.current
        ? Math.min(targetRef.current, progressRef.current + speed)
        : Math.max(targetRef.current, progressRef.current - speed)
      if (next !== progressRef.current) {
        progressRef.current = next
        setProgress(next)
      }
      if (next >= 1 && !completedRef.current) {
        completedRef.current = true
        targetRef.current = 1
        setCompleting(true)
        window.setTimeout(onComplete, 680)
      }
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [onComplete])

  const begin = event => {
    if (completedRef.current) return
    if (event.pointerType === 'mouse' && event.type === 'pointerdown') return
    targetRef.current = 1
  }

  const cancel = event => {
    if (event?.pointerType === 'mouse') return
    if (completedRef.current) return
    targetRef.current = 0
  }

  return (
    <button
      type="button"
      className={`reader-return-control${completing ? ' is-completing' : ''}`}
      style={{ '--return-progress': progress }}
      onMouseEnter={() => { targetRef.current = 1 }}
      onMouseLeave={() => { if (!completedRef.current) targetRef.current = 0 }}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={event => event.preventDefault()}
      aria-label="长按或悬停返回中枢"
    >
      <span>返回中枢</span>
      <span className="reader-return-track" aria-hidden="true"><span /></span>
    </button>
  )
}

export default ReaderReturnControl
