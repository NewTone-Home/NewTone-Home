import { useCallback, useEffect, useRef } from 'react'
import {
  accumulateWheelSteps,
  intentToReaderSteps,
  isReaderInputControl,
  keyToReaderIntent,
  normalizeWheelDelta,
} from '../reader/readerInput'

export function useReaderInput({ onSteps, wheelThreshold }) {
  const wheelRef = useRef(0)
  const onStepsRef = useRef(onSteps)
  const gestureRef = useRef({ id: 0, lastWheelAt: 0 })
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

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      wheelRef.current = 0
    }
  }, [dispatchSteps, wheelThreshold])

  return { dispatchSteps, clearInputAccumulator }
}
