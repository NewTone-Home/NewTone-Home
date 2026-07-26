import { useCallback, useEffect, useRef } from 'react'
import {
  accumulateWheelSteps,
  intentToReaderSteps,
  isReaderInputControl,
  keyToReaderIntent,
  normalizeWheelDelta,
} from '../reader/readerInput'

const MOBILE_SWIPE_STEP_PX = 86
const MOBILE_SWIPE_MAX_STEPS = 4
const MOBILE_SWIPE_MIN_PX = 28

function swipeDistanceToSteps(distance) {
  if (!Number.isFinite(distance) || Math.abs(distance) < MOBILE_SWIPE_MIN_PX) return 0
  const magnitude = Math.min(
    MOBILE_SWIPE_MAX_STEPS,
    Math.max(1, Math.round(Math.abs(distance) / MOBILE_SWIPE_STEP_PX)),
  )
  return Math.sign(distance) * magnitude
}

export function useReaderInput({ onSteps, wheelThreshold }) {
  const wheelRef = useRef(0)
  const touchRef = useRef(null)
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
    touchRef.current = null
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
      const startY = event.touches[0]?.clientY
      if (!Number.isFinite(startY)) return
      touchGestureRef.current += 1
      touchRef.current = { startY, currentY: startY }
    }

    const handleTouchMove = (event) => {
      if (!touchRef.current || isReaderInputControl(event.target)) return
      const currentY = event.touches[0]?.clientY
      if (!Number.isFinite(currentY)) return
      touchRef.current.currentY = currentY
      event.preventDefault()
    }

    const finishTouch = () => {
      const touch = touchRef.current
      touchRef.current = null
      if (!touch) return
      const steps = swipeDistanceToSteps(touch.startY - touch.currentY)
      dispatchSteps(steps, { source: 'touch', gestureId: `touch-${touchGestureRef.current}` })
    }

    const cancelTouch = () => {
      touchRef.current = null
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', finishTouch)
    window.addEventListener('touchcancel', cancelTouch)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', finishTouch)
      window.removeEventListener('touchcancel', cancelTouch)
      wheelRef.current = 0
      touchRef.current = null
    }
  }, [dispatchSteps, wheelThreshold])

  return { dispatchSteps, clearInputAccumulator }
}
