import { useCallback, useEffect, useRef } from 'react'
import {
  accumulateWheelSteps,
  intentToReaderSteps,
  isNativeReaderScrollTarget,
  isReaderInputControl,
  keyToReaderIntent,
  normalizeWheelDelta,
} from '../reader/readerInput'

export function useReaderInput({ onSteps, wheelThreshold, shouldSuppressForwardWheel, shouldSuppressWheel }) {
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
      const isReturnControl = event.target instanceof HTMLElement
        && event.target.closest('[data-reader-return-control="true"]')
      // The return control owns its wheel gesture. Letting the global reader
      // accumulator inspect the same event creates a race with page advance.
      if (isReturnControl || isReaderInputControl(event.target)) return
      if (isNativeReaderScrollTarget(event.target)) return
      if (shouldSuppressWheel?.()) return
      const now = performance.now()
      if (now - gestureRef.current.lastWheelAt > 140) gestureRef.current.id += 1
      gestureRef.current.lastWheelAt = now
      const normalizedDelta = normalizeWheelDelta(event.deltaY, event.deltaMode, window.innerHeight)
      if (normalizedDelta > 0 && shouldSuppressForwardWheel?.()) return
      event.preventDefault()
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
  }, [dispatchSteps, shouldSuppressForwardWheel, shouldSuppressWheel, wheelThreshold])

  return { dispatchSteps, clearInputAccumulator }
}
