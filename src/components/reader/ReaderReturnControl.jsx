import { useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import './ReaderReturnControl.css'

const RETURN_RING_DRAW_MS = 1700
const RETURN_RING_RETRACT_MS = 900
const RETURN_WHEEL_THRESHOLD = 8
const RETURN_DIRECT_THRESHOLD = 36

function hasHoverPointer() {
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true
}

function isDirectPointer(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen'
}

function ReaderReturnControl({ armed, onArm, onDisarm, onReadyChange, onComplete, language }) {
  const ui = getReaderUi(language)
  const fallbackUi = getReaderUi('zh')
  const returnLabel = ui.returnToLanding || ui.backToLanding || fallbackUi.returnToLanding
  const returnHint = ui.returnToLandingHint || ui.backToLanding || fallbackUi.returnToLandingHint
  const [progress, setProgress] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [arrowFadeComplete, setArrowFadeComplete] = useState(true)
  const progressRef = useRef(0)
  const completedRef = useRef(false)
  const pendingCompleteRef = useRef(false)
  const frameRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const visualArmed = armed && !completing

  useEffect(() => {
    cancelAnimationFrame(frameRef.current)
    if (!visualArmed && pendingCompleteRef.current && !arrowFadeComplete) return undefined
    const from = progressRef.current
    const target = visualArmed ? 1 : 0
    const distance = Math.abs(target - from)

    const finishTarget = () => {
      progressRef.current = target
      setProgress(target)
      frameRef.current = 0
      if (target === 0 && pendingCompleteRef.current) {
        pendingCompleteRef.current = false
        onCompleteRef.current()
      }
    }

    if (distance < 0.001) {
      finishTarget()
      return undefined
    }

    const fullDuration = visualArmed ? RETURN_RING_DRAW_MS : RETURN_RING_RETRACT_MS
    const duration = Math.max(80, fullDuration * distance)
    const startedAt = performance.now()

    const animate = time => {
      const raw = Math.min(1, (time - startedAt) / duration)
      const eased = raw * raw * (3 - 2 * raw)
      const next = from + (target - from) * eased
      progressRef.current = next
      setProgress(next)
      if (raw < 1) {
        frameRef.current = requestAnimationFrame(animate)
        return
      }
      finishTarget()
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [arrowFadeComplete, visualArmed])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  useEffect(() => {
    if (!armed && !pendingCompleteRef.current) setCompleting(false)
  }, [armed])

  const entryReady = visualArmed && progress >= 0.999

  useEffect(() => {
    onReadyChange?.(entryReady || completing)
  }, [completing, entryReady, onReadyChange])

  useEffect(() => {
    if (!visualArmed) return undefined
    completedRef.current = false
    let directGesture = null

    const completeOnce = () => {
      if (completedRef.current) return
      completedRef.current = true
      pendingCompleteRef.current = true
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      setArrowFadeComplete(!entryReady || reduced)
      setCompleting(true)
    }

    const onWheel = event => {
      if (event.deltaY > RETURN_WHEEL_THRESHOLD) completeOnce()
    }

    const onPointerDown = event => {
      if (!isDirectPointer(event.pointerType)) return
      directGesture = {
        pointerId: event.pointerId,
        startY: event.clientY,
      }
    }

    const onPointerMove = event => {
      if (!directGesture || event.pointerId !== directGesture.pointerId) return
      if (directGesture.startY - event.clientY <= RETURN_DIRECT_THRESHOLD) return
      directGesture = null
      completeOnce()
    }

    const clearDirectGesture = event => {
      if (!directGesture || event.pointerId !== directGesture.pointerId) return
      directGesture = null
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', clearDirectGesture, { passive: true })
    window.addEventListener('pointercancel', clearDirectGesture, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', clearDirectGesture)
      window.removeEventListener('pointercancel', clearDirectGesture)
    }
  }, [entryReady, visualArmed])

  const affordanceVisible = visualArmed || progress > 0.001

  return (
    <button
      type="button"
      className={`reader-return-control${visualArmed ? ' is-armed' : ''}${affordanceVisible ? ' has-affordance' : ''}`}
      style={{ '--return-progress': progress }}
      data-reader-return-control="true"
      data-return-armed={visualArmed ? 'true' : 'false'}
      data-return-progress={progress.toFixed(3)}
      data-return-ready={entryReady ? 'true' : 'false'}
      data-return-completing={completing ? 'true' : 'false'}
      onPointerEnter={event => {
        if (!completing && event.pointerType === 'mouse' && hasHoverPointer()) onArm()
      }}
      onPointerLeave={event => {
        if (!completing && !entryReady && event.pointerType === 'mouse' && hasHoverPointer()) onDisarm()
      }}
      onPointerUp={event => {
        if (!completing && isDirectPointer(event.pointerType) && !armed) onArm()
      }}
      onClick={event => {
        if (!completing && event.detail === 0 && !armed) onArm()
      }}
      aria-label={returnHint}
      aria-pressed={visualArmed}
      onTransitionEnd={event => {
        if (
          completing
          && event.propertyName === 'opacity'
          && event.target.classList.contains('reader-return-affordance__arrow')
        ) setArrowFadeComplete(true)
      }}
    >
      <span className="reader-return-text">{returnLabel}</span>
      <svg className="reader-return-affordance" viewBox="0 0 80 80" aria-hidden="true">
        <path className="reader-return-affordance__ring" pathLength="1" d="M40 5C61 4 74 17 74 39C74 61 61 75 39 74C17 73 5 61 6 39C7 17 19 6 40 5" />
        <path className="reader-return-affordance__arrow" pathLength="1" d="M40 22C39 33 40 45 40 57M31 48C34 52 37 56 40 59M49 48C46 52 43 56 40 59" />
      </svg>
    </button>
  )
}

export default ReaderReturnControl
