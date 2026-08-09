import { useCallback, useEffect, useRef, useState } from 'react'
import { TITLE_DRAW_MS, TITLE_PHASE, TITLE_RETRACT_MS } from '../landing/landingIntro'

/**
 * A hand, not an easing curve: the pen hesitates on the N, runs almost evenly
 * through the middle of the word, then eases off on the last e. The offsets are
 * fractions of the selected draw duration, the values are stroke progress
 * (1 = untouched).
 */
const DRAW_KEYFRAMES = [
  { strokeDashoffset: '1', offset: 0, easing: 'cubic-bezier(0.8, 0, 0.7, 0.45)' },
  { strokeDashoffset: '0.86', offset: 0.18, easing: 'cubic-bezier(0.4, 0.05, 0.6, 0.95)' },
  { strokeDashoffset: '0.1', offset: 0.8, easing: 'cubic-bezier(0.15, 0.7, 0.25, 1)' },
  { strokeDashoffset: '0', offset: 1 },
]

const RETRACT_EASING = 'cubic-bezier(0.5, 0, 0.85, 0.4)'

/**
 * Drives the sweep path that reveals the retraced title.
 *
 * begin/retract accept an optional duration override so a scene can reuse the
 * exact same stroke without inventing a second animation. Normal Landing keeps
 * the canonical timings; Reader-return Landing can run the same stroke faster.
 */
export function useTitleRetrace({ introCompleted, reduced, onIntroComplete }) {
  const sweepRef = useRef(null)
  const runningRef = useRef(null)
  const [phase, setPhase] = useState(TITLE_PHASE.IDLE)

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const introRef = useRef(introCompleted)
  introRef.current = introCompleted

  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  const completeRef = useRef(onIntroComplete)
  completeRef.current = onIntroComplete

  const readOffset = useCallback(() => {
    const el = sweepRef.current
    if (!el) return 1
    const raw = Number.parseFloat(window.getComputedStyle(el).strokeDashoffset)
    if (Number.isFinite(raw)) return Math.min(1, Math.max(0, raw))
    const timing = runningRef.current?.effect?.getComputedTiming?.()
    const progress = timing?.progress
    return Number.isFinite(progress) ? 1 - progress : 1
  }, [])

  const settle = useCallback((offset) => {
    runningRef.current?.cancel()
    runningRef.current = null
    const el = sweepRef.current
    if (el) el.style.strokeDashoffset = String(offset)
  }, [])

  const begin = useCallback((options = {}) => {
    if (phaseRef.current !== TITLE_PHASE.IDLE) return Promise.resolve(false)
    const el = sweepRef.current
    if (!el) return Promise.resolve(false)

    const duration = Number.isFinite(options.duration)
      ? Math.max(0, options.duration)
      : TITLE_DRAW_MS
    const markIntroComplete = options.markIntroComplete !== false
    const firstVisit = !introRef.current

    if (reducedRef.current || duration === 0) {
      settle(0)
      setPhase(TITLE_PHASE.REVEALED)
      if (firstVisit && markIntroComplete) completeRef.current?.()
      return Promise.resolve(true)
    }

    runningRef.current?.cancel()
    el.style.strokeDashoffset = ''
    setPhase(TITLE_PHASE.DRAWING)

    const anim = el.animate(DRAW_KEYFRAMES, { duration, fill: 'forwards' })
    runningRef.current = anim

    return anim.finished
      .then(() => {
        if (runningRef.current !== anim) return false
        setPhase(TITLE_PHASE.REVEALED)
        if (firstVisit && markIntroComplete) completeRef.current?.()
        return true
      })
      .catch(() => false)
  }, [settle])

  const retract = useCallback((options = {}) => {
    const el = sweepRef.current
    if (!el) return Promise.resolve(false)

    const duration = Number.isFinite(options.duration)
      ? Math.max(0, options.duration)
      : TITLE_RETRACT_MS
    const from = readOffset()

    if (reducedRef.current || duration === 0) {
      settle(1)
      setPhase(TITLE_PHASE.IDLE)
      return Promise.resolve(true)
    }

    runningRef.current?.cancel()
    el.style.strokeDashoffset = ''
    setPhase(TITLE_PHASE.RETRACTING)

    const anim = el.animate(
      [{ strokeDashoffset: String(from) }, { strokeDashoffset: '1' }],
      { duration, easing: RETRACT_EASING, fill: 'forwards' },
    )
    runningRef.current = anim

    return anim.finished
      .then(() => {
        if (runningRef.current !== anim) return false
        setPhase(TITLE_PHASE.IDLE)
        return true
      })
      .catch(() => false)
  }, [readOffset, settle])

  const reset = useCallback(() => {
    settle(1)
    setPhase(TITLE_PHASE.IDLE)
  }, [settle])

  useEffect(() => () => {
    runningRef.current?.cancel()
    runningRef.current = null
  }, [])

  return { phase, phaseRef, sweepRef, begin, retract, reset }
}
