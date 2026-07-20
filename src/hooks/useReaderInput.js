import { useCallback, useEffect, useRef } from 'react'
import {
  accumulateWheelSteps,
  intentToReaderSteps,
  isReaderInputControl,
  keyToReaderIntent,
  normalizeWheelDelta,
  touchToReaderIntent,
} from '../reader/readerInput'

export function useReaderInput({ onSteps, wheelThreshold }) {
  const wheelRef = useRef(0)
  const touchStartRef = useRef(null)
  const onStepsRef = useRef(onSteps)
  const gestureRef = useRef({ id: 0, lastWheelAt: 0 })
  const touchGestureRef = useRef(0)
  onStepsRef.current = onSteps

  const dispatchSteps = useCallback((steps, meta = {}) => {
    if (!Number.isInteger(steps) || steps === 0) return
    onStepsRef.current(steps, meta)
  }, [])

  const clearInputAccumulator = useCallback(() => {
    wheelRef.current = 0
  }, [])

  useEffect(() => {
    const handleWheel = (event) => {
      if (isReaderInputControl(event.target)) return
      event.preventDefault()
      const now = performance.now()
      if (now - gestureRef.current.lastWheelAt > 140) gestureRef.current.id += 1
      gestureRef.current.lastWheelAt = now
      const normalizedDelta = normalizeWheelDelta(event.deltaY, event.deltaMode, window.innerHeight)
      const next = accumulateWheelSteps(wheelRef.current, normalizedDelta, wheelThreshold)
      wheelRef.current = next.accumulated
      dispatchSteps(next.steps, { source: 'wheel', gestureId: gestureRef.current.id })
    }

    const handleKeyDown = (event) => {
      if (isReaderInputControl(event.target)) return
      const intent = keyToReaderIntent(event)
      if (!intent) return
      event.preventDefault()
      gestureRef.current.id += 1
      dispatchSteps(intentToReaderSteps(intent), { source: 'keyboard', gestureId: gestureRef.current.id })
    }

    const handleTouchStart = (event) => {
      if (isReaderInputControl(event.target)) return
      touchStartRef.current = event.touches[0]?.clientY ?? null
      touchGestureRef.current += 1
    }

    const handleTouchMove = (event) => {
      if (touchStartRef.current === null || isReaderInputControl(event.target)) return
      const currentY = event.touches[0]?.clientY
      const intent = touchToReaderIntent(touchStartRef.current, currentY)
      if (!intent) return
      event.preventDefault()
      touchStartRef.current = currentY
      dispatchSteps(intentToReaderSteps(intent), { source: 'touch', gestureId: `touch-${touchGestureRef.current}` })
    }

    const clearTouch = () => {
      touchStartRef.current = null
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', clearTouch)
    window.addEventListener('touchcancel', clearTouch)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', clearTouch)
      window.removeEventListener('touchcancel', clearTouch)
      wheelRef.current = 0
      touchStartRef.current = null
    }
  }, [dispatchSteps, wheelThreshold])

  return { dispatchSteps, clearInputAccumulator }
}
