import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import { useScrambleText } from '../../hooks/useScrambleText'
import LandingEntryArrow from '../landing/LandingEntryArrow'
import './ReaderReturnControl.css'

const RETURN_RING_DRAW_MS = 2200
const RETURN_RING_RETRACT_MS = 1200
const RETURN_TEXT_EXIT_MS = 900
const RETURN_WHEEL_THRESHOLD = 8
const RETURN_DIRECT_THRESHOLD = 36

function hasHoverPointer() {
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true
}

function isDirectPointer(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen'
}

function ReaderReturnControl({ armed, onArm, onDisarm, onDismissStart, onDismissComplete, onReadyChange, onStart, onComplete, language }) {
  const ui = getReaderUi(language)
  const fallbackUi = getReaderUi('zh')
  const returnLabel = ui.returnToLanding || ui.backToLanding || fallbackUi.returnToLanding
  const returnHint = ui.returnToLandingHint || ui.backToLanding || fallbackUi.returnToLandingHint
  const returnTextRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completing, setCompleting] = useState(false)
  const progressRef = useRef(0)
  const completedRef = useRef(false)
  const pendingCompleteRef = useRef(false)
  const textExitCompleteRef = useRef(false)
  const arrowExitCompleteRef = useRef(false)
  const progressExitCompleteRef = useRef(false)
  const completionReportedRef = useRef(false)
  const dismissOnlyRef = useRef(false)
  const dismissReportedRef = useRef(false)
  const reducedExitRef = useRef(false)
  const frameRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  const onDismissStartRef = useRef(onDismissStart)
  const onDismissCompleteRef = useRef(onDismissComplete)
  const onStartRef = useRef(onStart)
  onCompleteRef.current = onComplete
  onDismissStartRef.current = onDismissStart
  onDismissCompleteRef.current = onDismissComplete
  onStartRef.current = onStart

  const visualArmed = armed && !completing

  const maybeCompleteReturn = useCallback(() => {
    if (!textExitCompleteRef.current
      || (!arrowExitCompleteRef.current && !reducedExitRef.current)
      || (!progressExitCompleteRef.current && !reducedExitRef.current)) return

    if (pendingCompleteRef.current) {
      if (completionReportedRef.current) return
      completionReportedRef.current = true
      pendingCompleteRef.current = false
      onCompleteRef.current()
      return
    }

    if (dismissOnlyRef.current && !dismissReportedRef.current) {
      dismissReportedRef.current = true
      dismissOnlyRef.current = false
      onDismissCompleteRef.current?.()
    }
  }, [])

  const handleTextExitComplete = useCallback(() => {
    textExitCompleteRef.current = true
    maybeCompleteReturn()
  }, [maybeCompleteReturn])

  const handleArrowExitComplete = useCallback(() => {
    arrowExitCompleteRef.current = true
    maybeCompleteReturn()
  }, [maybeCompleteReturn])

  const { displayText: returnDisplayText, stable: returnTextStable } = useScrambleText(returnLabel, {
    charInterval: Math.max(70, Math.floor(650 / Math.max(1, returnLabel.length))),
    scrambleInterval: 40,
    withdrawing: completing,
    withdrawalDuration: RETURN_TEXT_EXIT_MS,
    onWithdrawn: handleTextExitComplete,
  })

  useEffect(() => {
    cancelAnimationFrame(frameRef.current)
    const from = progressRef.current
    const target = visualArmed ? 1 : 0
    const distance = Math.abs(target - from)

    const finishTarget = () => {
      progressRef.current = target
      setProgress(target)
      if (target === 0) {
        progressExitCompleteRef.current = true
        maybeCompleteReturn()
      }
      frameRef.current = 0
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
  }, [visualArmed])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  useEffect(() => {
    if (!armed && !pendingCompleteRef.current && !dismissOnlyRef.current) setCompleting(false)
  }, [armed])

  const entryReady = visualArmed && progress >= 0.999

  useEffect(() => {
    onReadyChange?.(visualArmed || completing)
  }, [completing, onReadyChange, visualArmed])

  useEffect(() => {
    if (!visualArmed) return undefined
    completedRef.current = false
    let directGesture = null

    const startExit = (navigate = true) => {
      if (completedRef.current) return
      completedRef.current = true
      pendingCompleteRef.current = navigate
      dismissOnlyRef.current = !navigate
      completionReportedRef.current = false
      dismissReportedRef.current = false
      textExitCompleteRef.current = false
      arrowExitCompleteRef.current = false
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      reducedExitRef.current = reduced
      progressExitCompleteRef.current = reduced
      if (navigate) onStartRef.current?.()
      if (!navigate) onDismissStartRef.current?.()
      setCompleting(true)
      setHovered(false)
      if (reduced) {
        textExitCompleteRef.current = true
        arrowExitCompleteRef.current = true
        maybeCompleteReturn()
      }
    }

    const onWheel = event => {
      if (event.deltaY > RETURN_WHEEL_THRESHOLD) startExit(true)
      if (event.deltaY < -RETURN_WHEEL_THRESHOLD) startExit(false)
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
      const delta = directGesture.startY - event.clientY
      if (delta <= RETURN_DIRECT_THRESHOLD && delta >= -RETURN_DIRECT_THRESHOLD) return
      directGesture = null
      if (delta > RETURN_DIRECT_THRESHOLD) {
        startExit(true)
        return
      }
      startExit(false)
    }

    const onPointerUp = event => {
      if (!directGesture || event.pointerId !== directGesture.pointerId) return
      const gesture = directGesture
      directGesture = null
      if (Math.abs(gesture.startY - event.clientY) <= RETURN_DIRECT_THRESHOLD) onDisarm()
    }

    const clearDirectGesture = event => {
      if (!directGesture || event.pointerId !== directGesture.pointerId) return
      directGesture = null
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', clearDirectGesture, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', clearDirectGesture)
    }
  }, [maybeCompleteReturn, onDisarm, visualArmed])

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
        if (event.pointerType === 'mouse') setHovered(true)
        if (!completing && event.pointerType === 'mouse' && hasHoverPointer()) onArm()
      }}
      onPointerLeave={event => {
        setHovered(false)
        if (!completing && !entryReady && event.pointerType === 'mouse' && hasHoverPointer()) onDisarm()
      }}
      onPointerDown={event => {
        if (!completing && isDirectPointer(event.pointerType) && !armed) onArm()
      }}
      onClick={event => {
        if (completing || event.detail !== 0) return
        if (armed) onDisarm()
        else onArm()
      }}
      aria-label={returnHint}
      aria-pressed={visualArmed}
    >
      <span className="reader-return-text-row">
        <span ref={returnTextRef} className="reader-return-text" data-stable={returnTextStable ? 'true' : 'false'}>
          {returnDisplayText || returnLabel}
        </span>
        <LandingEntryArrow
          className="reader-return-entry-arrow"
          direction={completing ? 'left' : hovered || armed ? 'down' : 'right'}
          initialDirection="right"
          phase={completing ? 'retracting' : 'steady'}
          sourceRef={returnTextRef}
          entryReady={returnTextStable}
          exitDelayMs={0}
          exitDurationMs={RETURN_TEXT_EXIT_MS}
          showRing={false}
          onExitComplete={handleArrowExitComplete}
        />
      </span>
    </button>
  )
}

export default ReaderReturnControl
