import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import './ReaderReturnControl.css'

const RETURN_DRAW_MS = 1750
const RETURN_FLASH_MS = 560
const RETURN_INPUT_SETTLE_MS = 240

function ReaderReturnControl({ onComplete, language }) {
  const ui = getReaderUi(language)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('idle')
  const targetRef = useRef(0)
  const progressRef = useRef(0)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const completedRef = useRef(false)
  const exitTimerRef = useRef(0)
  const inputReadyRef = useRef(false)
  const settleTimerRef = useRef(0)
  const pointerInsideRef = useRef(false)
  const pendingBeginRef = useRef(false)
  const textRef = useRef(null)

  const finish = useCallback((delay = RETURN_FLASH_MS) => {
    if (completedRef.current) return
    completedRef.current = true
    targetRef.current = 1
    progressRef.current = 1
    setProgress(1)
    setPhase('completing')
    exitTimerRef.current = window.setTimeout(onComplete, delay)
  }, [onComplete])

  const returnEarly = useCallback(() => {
    if (completedRef.current || progressRef.current <= 0 || progressRef.current >= 1) return
    completedRef.current = true
    targetRef.current = 0
    setPhase('retracting')
    exitTimerRef.current = window.setTimeout(onComplete, 120)
  }, [onComplete])

  const startDrawing = useCallback(() => {
    if (completedRef.current) return
    pendingBeginRef.current = false
    targetRef.current = 1
    setPhase('drawing')
  }, [])

  const begin = useCallback(() => {
    pointerInsideRef.current = true
    if (!inputReadyRef.current) {
      pendingBeginRef.current = true
      return
    }
    startDrawing()
  }, [startDrawing])

  const retract = useCallback(() => {
    pointerInsideRef.current = false
    pendingBeginRef.current = false
    if (completedRef.current) return
    targetRef.current = 0
    setPhase(progressRef.current > 0 ? 'retracting' : 'idle')
  }, [])

  useEffect(() => {
    const animate = time => {
      const delta = lastTimeRef.current ? Math.min(40, time - lastTimeRef.current) : 16
      lastTimeRef.current = time
      const rising = targetRef.current > progressRef.current
      const speed = rising ? delta / RETURN_DRAW_MS : delta / 360
      const next = rising
        ? Math.min(targetRef.current, progressRef.current + speed)
        : Math.max(targetRef.current, progressRef.current - speed)
      if (next !== progressRef.current) {
        progressRef.current = next
        setProgress(next)
      }
      if (next <= 0 && targetRef.current === 0 && !completedRef.current) setPhase('idle')
      if (next >= 1) finish()
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frameRef.current)
      window.clearTimeout(exitTimerRef.current)
    }
  }, [finish])

  useEffect(() => {
    const settleInput = () => {
      inputReadyRef.current = false
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = window.setTimeout(() => {
        inputReadyRef.current = true
        if (pointerInsideRef.current && pendingBeginRef.current) startDrawing()
      }, RETURN_INPUT_SETTLE_MS)
    }
    settleInput()
    const onWheel = event => {
      const drawing = progressRef.current > 0 && progressRef.current < 1
      if (!drawing || event.deltaY <= 8) return
      event.preventDefault()
      event.stopPropagation()
      if (!inputReadyRef.current) {
        settleInput()
        return
      }
      returnEarly()
    }
    let touchStartY = 0
    const onTouchStart = event => { touchStartY = event.touches[0]?.clientY ?? 0 }
    const onTouchMove = event => {
      const currentY = event.touches[0]?.clientY ?? touchStartY
      if (touchStartY - currentY <= 16) return
      if (!inputReadyRef.current) {
        settleInput()
        return
      }
      returnEarly()
    }
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true })
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.clearTimeout(settleTimerRef.current)
    }
  }, [returnEarly, startDrawing])

  useEffect(() => {
    const trackTextBoundary = event => {
      const pointedNode = document.elementFromPoint(event.clientX, event.clientY)
      if (pointedNode && textRef.current?.contains(pointedNode)) {
        begin()
        return
      }
      if (pointerInsideRef.current) retract()
    }
    window.addEventListener('pointermove', trackTextBoundary)
    return () => window.removeEventListener('pointermove', trackTextBoundary)
  }, [begin, retract])

  return (
    <button
      type="button"
      className={`reader-return-control is-${phase}`}
      style={{ '--return-progress': progress }}
      data-return-phase={phase}
      data-return-progress={progress.toFixed(3)}
      onContextMenu={event => event.preventDefault()}
      aria-label={ui.returnToLandingHint}
    >
      <span
        ref={textRef}
        className="reader-return-text"
        onPointerEnter={begin}
        onPointerMove={begin}
        onPointerLeave={retract}
        onPointerDown={begin}
        onPointerUp={event => { if (event.pointerType === 'touch') retract() }}
        onPointerCancel={retract}
      >
        {ui.returnToLanding}
      </span>
      <svg className="reader-return-ring" viewBox="0 0 180 54" preserveAspectRatio="none" aria-hidden="true">
        <path pathLength="1" d="M8 27C10 8 39 4 88 5C135 3 169 10 172 25C174 42 143 50 90 49C39 51 5 44 8 27Z" />
        <path className="reader-return-ring-echo" pathLength="1" d="M8 27C10 8 39 4 88 5C135 3 169 10 172 25C174 42 143 50 90 49C39 51 5 44 8 27Z" />
      </svg>
    </button>
  )
}

export default ReaderReturnControl
