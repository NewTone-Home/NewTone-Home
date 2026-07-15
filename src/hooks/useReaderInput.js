import { useCallback, useEffect, useRef } from 'react'
import {
  accumulateWheelIntent,
  consumeReaderIntent,
  enqueueReaderIntent,
  isReaderInputControl,
  keyToReaderIntent,
  touchToReaderIntent,
} from '../reader/readerInput'

export function useReaderInput({ animationLocked, onIntent }) {
  const wheelRef = useRef(0)
  const queueRef = useRef([])
  const touchStartRef = useRef(null)
  const lockedRef = useRef(animationLocked)
  const onIntentRef = useRef(onIntent)
  lockedRef.current = animationLocked
  onIntentRef.current = onIntent

  const dispatchIntent = useCallback((intent) => {
    if (!intent) return
    if (lockedRef.current) {
      queueRef.current = enqueueReaderIntent(queueRef.current, intent)
      return
    }
    const shouldLock = onIntentRef.current(intent)
    if (shouldLock) lockedRef.current = true
  }, [])

  useEffect(() => {
    if (animationLocked) return
    const next = consumeReaderIntent(queueRef.current)
    queueRef.current = next.queue
    if (next.intent) {
      const shouldLock = onIntentRef.current(next.intent)
      if (shouldLock) lockedRef.current = true
    }
  }, [animationLocked])

  useEffect(() => {
    const handleWheel = (event) => {
      if (isReaderInputControl(event.target)) return
      event.preventDefault()
      const next = accumulateWheelIntent(wheelRef.current, event.deltaY)
      wheelRef.current = next.accumulated
      dispatchIntent(next.intent)
    }

    const handleKeyDown = (event) => {
      if (isReaderInputControl(event.target)) return
      const intent = keyToReaderIntent(event)
      if (!intent) return
      event.preventDefault()
      dispatchIntent(intent)
    }

    const handleTouchStart = (event) => {
      if (isReaderInputControl(event.target)) return
      touchStartRef.current = event.touches[0]?.clientY ?? null
    }

    const handleTouchMove = (event) => {
      if (touchStartRef.current === null || isReaderInputControl(event.target)) return
      const currentY = event.touches[0]?.clientY
      const intent = touchToReaderIntent(touchStartRef.current, currentY)
      if (!intent) return
      event.preventDefault()
      touchStartRef.current = currentY
      dispatchIntent(intent)
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
      queueRef.current = []
      wheelRef.current = 0
      touchStartRef.current = null
    }
  }, [dispatchIntent])

  return dispatchIntent
}
