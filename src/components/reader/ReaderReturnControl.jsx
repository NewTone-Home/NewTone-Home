import { useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import './ReaderReturnControl.css'

const RETURN_LINE_DRAW_MS = 560
const RETURN_LINE_RETRACT_MS = 320
const RETURN_WHEEL_THRESHOLD = 8
const RETURN_DIRECT_THRESHOLD = 36

function hasHoverPointer() {
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true
}

function isDirectPointer(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen'
}

function ReaderReturnControl({ armed, onArm, onDisarm, onComplete, language }) {
  const ui = getReaderUi(language)
  const [progress, setProgress] = useState(0)
  const [completing, setCompleting] = useState(false)
  const progressRef = useRef(0)
  const completedRef = useRef(false)
  const pendingCompleteRef = useRef(false)
  const frameRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const visualArmed = armed && !completing

  useEffect(() => {
    cancelAnimationFrame(frameRef.current)
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

    const fullDuration = visualArmed ? RETURN_LINE_DRAW_MS : RETURN_LINE_RETRACT_MS
    const duration = Math.max(80, fullDuration * distance)
    const startedAt = performance.now()

    const animate = time => {
      const raw = Math.min(1, (time - startedAt) / duration)
      const eased = visualArmed
        ? 1 - Math.pow(1 - raw, 3)
        : raw * raw * (3 - 2 * raw)
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
  }, [visualArmed])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  useEffect(() => {
    if (!armed && !pendingCompleteRef.current) setCompleting(false)
  }, [armed])

  useEffect(() => {
    if (!visualArmed) return undefined
    completedRef.current = false
    let directGesture = null

    const completeOnce = () => {
      if (completedRef.current) return
      completedRef.current = true
      pendingCompleteRef.current = true
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
  }, [visualArmed])

  const affordanceVisible = visualArmed || progress > 0.001

  return (
    <button
      type="button"
      className={`reader-return-control${visualArmed ? ' is-armed' : ''}${affordanceVisible ? ' has-affordance' : ''}`}
      style={{ '--return-progress': progress }}
      data-reader-return-control="true"
      data-return-armed={visualArmed ? 'true' : 'false'}
      data-return-progress={progress.toFixed(3)}
      data-return-completing={completing ? 'true' : 'false'}
      onPointerEnter={event => {
        if (!completing && event.pointerType === 'mouse' && hasHoverPointer()) onArm()
      }}
      onPointerLeave={event => {
        if (!completing && event.pointerType === 'mouse' && hasHoverPointer()) onDisarm()
      }}
      onPointerUp={event => {
        if (!completing && isDirectPointer(event.pointerType) && !armed) onArm()
      }}
      onClick={event => {
        if (!completing && event.detail === 0 && !armed) onArm()
      }}
      aria-label={ui.returnToLandingHint}
      aria-pressed={visualArmed}
    >
      <span className="reader-return-text">{ui.returnToLanding}</span>
      <svg className="reader-return-affordance" viewBox="0 0 112 31" aria-hidden="true">
        <path className="reader-return-affordance__line" pathLength="1" d="M4 5.8C24 3.1 45 7.4 65 5.1C82 3.2 97 5.8 108 4.2" />
        <path className="reader-return-affordance__line reader-return-affordance__line--second" pathLength="1" d="M13 11.8C31 9.4 50 13.5 68 10.7C82 8.8 94 11.9 102 10.2" />
        <path className="reader-return-affordance__arrow" d="M56 17C55 21 56 24 56 28M51 24C53 26 55 28 56 29M61 24C59 26 57 28 56 29" />
      </svg>
    </button>
  )
}

export default ReaderReturnControl
