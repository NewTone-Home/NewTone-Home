import { useCallback, useEffect, useRef, useState } from 'react'
import { getReaderUi } from '../../i18n/readerUi'
import { useScrambleText } from '../../hooks/useScrambleText'
import LandingEntryArrow from '../landing/LandingEntryArrow'
import './ReaderReturnControl.css'

const RETURN_RING_DRAW_MS = 2200
const RETURN_RING_RETRACT_MS = 1200
const RETURN_TEXT_EXIT_MS = 900

function ReaderReturnControl({
  armed,
  onDismissStart,
  onDismissComplete,
  exitRequestId = 0,
  exitRequestMode = 'dismiss',
  onReadyChange,
  onStart,
  onComplete,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onClick,
  language,
}) {
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
  const handledExitRequestRef = useRef(0)
  const reducedExitRef = useRef(false)
  const frameRef = useRef(0)
  const startExitRef = useRef(null)
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
    onReadyChange?.(entryReady || completing)
  }, [completing, entryReady, onReadyChange])

  const startExit = useCallback((navigate = true) => {
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
  }, [maybeCompleteReturn])

  startExitRef.current = startExit

  useEffect(() => {
    if (!exitRequestId) {
      handledExitRequestRef.current = 0
      return
    }
    if (handledExitRequestRef.current === exitRequestId) return
    handledExitRequestRef.current = exitRequestId
    startExitRef.current?.(exitRequestMode === 'return')
  }, [exitRequestId, exitRequestMode])

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
        onPointerEnter?.(event)
      }}
      onPointerLeave={event => {
        setHovered(false)
        onPointerLeave?.(event)
      }}
      onPointerDown={onPointerDown}
      onClick={onClick}
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
