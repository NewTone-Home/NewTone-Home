import { useCallback, useEffect, useRef, useState } from 'react'

export const ENTRY_BUTTON_TIMINGS = Object.freeze({
  textEnter: 320,
  frameEnter: 720,
  fillOpen: 520,
  textExit: 260,
  fillClose: 520,
  frameExit: 420,
})

export function createEntryProgress(overrides = {}) {
  return { text: 0, frame: 0, fill: 0, ...overrides }
}

function clamp(value) {
  return Math.max(0, Math.min(1, value))
}

function easeInOut(value) {
  return value * value * (3 - 2 * value)
}

export function useEntryButtonTimeline({
  initialProgress = createEntryProgress(),
  onStart,
  onCancel,
  onStep,
} = {}) {
  const [progress, setProgress] = useState(() => ({ ...initialProgress }))
  const progressRef = useRef({ ...initialProgress })
  const timelineRef = useRef({ token: 0, frame: 0 })
  const callbacksRef = useRef({ onStart, onCancel, onStep })
  callbacksRef.current = { onStart, onCancel, onStep }

  const setProgressValue = useCallback((key, value) => {
    const next = { ...progressRef.current, [key]: value }
    progressRef.current = next
    setProgress(next)
  }, [])

  const cancelTimeline = useCallback(() => {
    const hadFrame = Boolean(timelineRef.current.frame)
    if (timelineRef.current.frame) window.cancelAnimationFrame(timelineRef.current.frame)
    timelineRef.current = {
      token: timelineRef.current.token + 1,
      frame: 0,
    }
    if (hadFrame) callbacksRef.current.onCancel?.()
  }, [])

  const runTimeline = useCallback((steps, onComplete) => {
    cancelTimeline()
    const token = timelineRef.current.token
    callbacksRef.current.onStart?.(steps)
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    let stepIndex = 0

    const runNextStep = () => {
      if (token !== timelineRef.current.token) return
      const step = steps[stepIndex]
      if (!step) {
        timelineRef.current.frame = 0
        onComplete?.()
        return
      }

      stepIndex += 1
      const from = progressRef.current[step.key]
      const target = clamp(step.to)
      const duration = reducedMotion ? Math.min(120, step.duration) : step.duration
      const finishStep = () => {
        setProgressValue(step.key, target)
        callbacksRef.current.onStep?.({ key: step.key, progress: target })
        runNextStep()
      }

      if (Math.abs(target - from) < 0.001 || duration <= 0) {
        finishStep()
        return
      }

      const startedAt = performance.now()
      const tick = now => {
        if (token !== timelineRef.current.token) return
        const raw = Math.min(1, (now - startedAt) / duration)
        setProgressValue(step.key, from + (target - from) * easeInOut(raw))
        if (raw < 1) {
          timelineRef.current.frame = window.requestAnimationFrame(tick)
          return
        }
        timelineRef.current.frame = 0
        finishStep()
      }

      timelineRef.current.frame = window.requestAnimationFrame(tick)
    }

    runNextStep()
  }, [cancelTimeline, setProgressValue])

  useEffect(() => () => cancelTimeline(), [cancelTimeline])

  return {
    progress,
    progressRef,
    timelineRef,
    runTimeline,
    cancelTimeline,
  }
}
