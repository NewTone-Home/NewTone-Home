import { useCallback, useEffect, useRef, useState } from 'react'
import LandingEntryArrow from './landing/LandingEntryArrow'
import ScrambleText from './ScrambleText'
import { resolveTouchReturnSwipe, UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import './LandingUpdatesPage.css'

const RETURN_ENTRY_PHASE = Object.freeze({
  HIDDEN: 'hidden',
  TEXT: 'text',
  ARROW: 'arrow',
  RING: 'ring',
  READY: 'ready',
  WITHDRAW_RING: 'withdraw-ring',
  WITHDRAW_ARROW: 'withdraw-arrow',
  WITHDRAW_TEXT: 'withdraw-text',
})

const RETURN_ENTRY_WITHDRAWAL_REASON = Object.freeze({
  LEAVE: 'leave',
  OUTSIDE: 'outside',
  WHEEL: 'wheel',
})

const RETURN_ENTRY_WITHDRAWAL_TIMING = Object.freeze({
  leave: Object.freeze({ ring: 560, arrow: 360, text: 520, backdrop: 900, fallback: 1600 }),
  wheel: Object.freeze({ ring: 360, arrow: 240, text: 360, backdrop: 600, fallback: 1120 }),
})

function isWithdrawalPhase(phase) {
  return [
    RETURN_ENTRY_PHASE.WITHDRAW_RING,
    RETURN_ENTRY_PHASE.WITHDRAW_ARROW,
    RETURN_ENTRY_PHASE.WITHDRAW_TEXT,
  ].includes(phase)
}

function isDesktopPointer(event) {
  return ['mouse', 'pen'].includes(event.pointerType)
}

function LandingUpdatesPage({ phase, onSurfaceComplete, onReturnRequested }) {
  const [returnEntryPhase, setReturnEntryPhase] = useState(RETURN_ENTRY_PHASE.HIDDEN)
  const [mobileReturnArmed, setMobileReturnArmed] = useState(false)
  const [mobileReturnReady, setMobileReturnReady] = useState(false)
  const touchGestureRef = useRef(null)
  const returnTriggerRef = useRef(null)
  const returnEntryPhaseRef = useRef(RETURN_ENTRY_PHASE.HIDDEN)
  const returnEntryGenerationRef = useRef(0)
  const returnEntryInstanceRef = useRef(0)
  const withdrawalOriginRef = useRef(RETURN_ENTRY_PHASE.HIDDEN)
  const withdrawalReasonRef = useRef(null)
  const withdrawalTimingRef = useRef(RETURN_ENTRY_WITHDRAWAL_TIMING.leave)
  const withdrawalVisiblePartsRef = useRef({ ring: false, arrow: false })
  const returnNavigationIssuedRef = useRef(false)
  const withdrawalTimerRef = useRef(0)

  const visible = phase !== UPDATES_PHASE.LANDING
  const interactive = phase === UPDATES_PHASE.UPDATES

  const clearWithdrawalTimer = useCallback(() => {
    if (!withdrawalTimerRef.current) return
    window.clearTimeout(withdrawalTimerRef.current)
    withdrawalTimerRef.current = 0
  }, [])

  const transitionReturnEntry = useCallback((nextPhase) => {
    returnEntryPhaseRef.current = nextPhase
    setReturnEntryPhase(nextPhase)
  }, [])

  const resetReturnEntry = useCallback(() => {
    clearWithdrawalTimer()
    returnEntryGenerationRef.current += 1
    withdrawalOriginRef.current = RETURN_ENTRY_PHASE.HIDDEN
    withdrawalReasonRef.current = null
    withdrawalTimingRef.current = RETURN_ENTRY_WITHDRAWAL_TIMING.leave
    withdrawalVisiblePartsRef.current = { ring: false, arrow: false }
    returnNavigationIssuedRef.current = false
    returnEntryPhaseRef.current = RETURN_ENTRY_PHASE.HIDDEN
    setReturnEntryPhase(RETURN_ENTRY_PHASE.HIDDEN)
    setMobileReturnArmed(false)
    setMobileReturnReady(false)
    touchGestureRef.current = null
  }, [clearWithdrawalTimer])

  const requestReturnToLanding = useCallback(() => {
    if (returnNavigationIssuedRef.current) return
    returnNavigationIssuedRef.current = true
    onReturnRequested()
  }, [onReturnRequested])

  const advanceWithdrawalStage = useCallback((phaseToAdvance) => {
    if (returnEntryPhaseRef.current !== phaseToAdvance) return
    if (phaseToAdvance === RETURN_ENTRY_PHASE.WITHDRAW_RING) {
      transitionReturnEntry(
        withdrawalVisiblePartsRef.current.arrow
          ? RETURN_ENTRY_PHASE.WITHDRAW_ARROW
          : RETURN_ENTRY_PHASE.WITHDRAW_TEXT,
      )
      return
    }
    if (phaseToAdvance === RETURN_ENTRY_PHASE.WITHDRAW_ARROW) {
      transitionReturnEntry(RETURN_ENTRY_PHASE.WITHDRAW_TEXT)
    }
  }, [transitionReturnEntry])

  const beginWithdrawal = useCallback(({
    reason = RETURN_ENTRY_WITHDRAWAL_REASON.LEAVE,
    returnToLanding = false,
  } = {}) => {
    const currentPhase = returnEntryPhaseRef.current
    if (!interactive && !isWithdrawalPhase(currentPhase)) return

    if (currentPhase === RETURN_ENTRY_PHASE.HIDDEN) {
      return
    }
    if (isWithdrawalPhase(currentPhase)) {
      if (returnToLanding) {
        withdrawalReasonRef.current = RETURN_ENTRY_WITHDRAWAL_REASON.WHEEL
        requestReturnToLanding()
      }
      return
    }

    clearWithdrawalTimer()
    returnEntryGenerationRef.current += 1
    withdrawalOriginRef.current = currentPhase
    withdrawalReasonRef.current = reason
    withdrawalTimingRef.current = reason === RETURN_ENTRY_WITHDRAWAL_REASON.WHEEL
      ? RETURN_ENTRY_WITHDRAWAL_TIMING.wheel
      : RETURN_ENTRY_WITHDRAWAL_TIMING.leave
    withdrawalVisiblePartsRef.current = {
      ring: [RETURN_ENTRY_PHASE.RING, RETURN_ENTRY_PHASE.READY].includes(currentPhase),
      arrow: [RETURN_ENTRY_PHASE.ARROW, RETURN_ENTRY_PHASE.RING, RETURN_ENTRY_PHASE.READY].includes(currentPhase),
    }
    returnNavigationIssuedRef.current = false

    const firstWithdrawalPhase = withdrawalVisiblePartsRef.current.ring
      ? RETURN_ENTRY_PHASE.WITHDRAW_RING
      : withdrawalVisiblePartsRef.current.arrow
        ? RETURN_ENTRY_PHASE.WITHDRAW_ARROW
        : RETURN_ENTRY_PHASE.WITHDRAW_TEXT
    const withdrawalGeneration = returnEntryGenerationRef.current
    transitionReturnEntry(firstWithdrawalPhase)
    withdrawalTimerRef.current = window.setTimeout(() => {
      if (
        returnEntryGenerationRef.current === withdrawalGeneration
        && isWithdrawalPhase(returnEntryPhaseRef.current)
      ) resetReturnEntry()
    }, withdrawalTimingRef.current.fallback)

    if (returnToLanding) requestReturnToLanding()
  }, [clearWithdrawalTimer, interactive, requestReturnToLanding, resetReturnEntry, transitionReturnEntry])

  const beginDesktopReturnEntry = useCallback(() => {
    if (!interactive) return
    if (
      returnEntryPhaseRef.current !== RETURN_ENTRY_PHASE.HIDDEN
      && !isWithdrawalPhase(returnEntryPhaseRef.current)
    ) return

    clearWithdrawalTimer()
    returnEntryGenerationRef.current += 1
    returnEntryInstanceRef.current += 1
    withdrawalOriginRef.current = RETURN_ENTRY_PHASE.HIDDEN
    withdrawalReasonRef.current = null
    withdrawalTimingRef.current = RETURN_ENTRY_WITHDRAWAL_TIMING.leave
    withdrawalVisiblePartsRef.current = { ring: false, arrow: false }
    returnNavigationIssuedRef.current = false
    transitionReturnEntry(RETURN_ENTRY_PHASE.TEXT)
  }, [clearWithdrawalTimer, interactive, transitionReturnEntry])

  useEffect(() => {
    const preserveWheelWithdrawal = isWithdrawalPhase(returnEntryPhaseRef.current)
      && withdrawalReasonRef.current === RETURN_ENTRY_WITHDRAWAL_REASON.WHEEL
    if (phase === UPDATES_PHASE.LANDING || (!interactive && !preserveWheelWithdrawal)) {
      resetReturnEntry()
    }
  }, [interactive, phase, resetReturnEntry])

  useEffect(() => {
    if (
      returnEntryPhase !== RETURN_ENTRY_PHASE.WITHDRAW_RING
      && returnEntryPhase !== RETURN_ENTRY_PHASE.WITHDRAW_ARROW
    ) return undefined

    const withdrawalGeneration = returnEntryGenerationRef.current
    const duration = returnEntryPhase === RETURN_ENTRY_PHASE.WITHDRAW_RING
      ? withdrawalTimingRef.current.ring
      : withdrawalTimingRef.current.arrow
    const timer = window.setTimeout(() => {
      if (returnEntryGenerationRef.current !== withdrawalGeneration) return
      advanceWithdrawalStage(returnEntryPhase)
    }, duration + 80)
    return () => window.clearTimeout(timer)
  }, [advanceWithdrawalStage, returnEntryPhase])

  useEffect(() => {
    if (!interactive) return undefined

    const onWheel = (event) => {
      const currentPhase = returnEntryPhaseRef.current
      const desktopReturnActive = currentPhase !== RETURN_ENTRY_PHASE.HIDDEN

      if (desktopReturnActive) {
        beginWithdrawal({
          reason: RETURN_ENTRY_WITHDRAWAL_REASON.WHEEL,
          returnToLanding: event.deltaY < -8,
        })
        return
      }

      if (event.deltaY < -8 && mobileReturnReady) onReturnRequested()
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [beginWithdrawal, interactive, mobileReturnReady, onReturnRequested])

  useEffect(() => {
    if (!interactive) return undefined

    const onPointerDown = event => {
      if (!isDesktopPointer(event)) return
      if (returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.HIDDEN) return
      if (returnTriggerRef.current?.contains(event.target)) return
      beginWithdrawal({ reason: RETURN_ENTRY_WITHDRAWAL_REASON.OUTSIDE })
    }

    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => window.removeEventListener('pointerdown', onPointerDown, { capture: true })
  }, [beginWithdrawal, interactive])

  useEffect(() => {
    if (!interactive || !mobileReturnReady) return undefined

    const onPointerDown = event => {
      if (!['touch', 'pen'].includes(event.pointerType)) return
      touchGestureRef.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startY: event.clientY,
      }
    }
    const onPointerMove = event => {
      const gesture = touchGestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      const shouldReturn = resolveTouchReturnSwipe({
        armed: mobileReturnArmed,
        ready: mobileReturnReady,
        pointerType: gesture.pointerType,
        startY: gesture.startY,
        endY: event.clientY,
      })
      if (!shouldReturn) return
      touchGestureRef.current = null
      if (event.cancelable) event.preventDefault()
      onReturnRequested()
    }
    const clearGesture = event => {
      if (touchGestureRef.current?.pointerId === event.pointerId) touchGestureRef.current = null
    }

    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', clearGesture, { passive: true })
    window.addEventListener('pointercancel', clearGesture, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', clearGesture)
      window.removeEventListener('pointercancel', clearGesture)
    }
  }, [interactive, mobileReturnArmed, mobileReturnReady, onReturnRequested])

  const handleReturnPointerEnter = useCallback((event) => {
    if (!isDesktopPointer(event)) return
    beginDesktopReturnEntry()
  }, [beginDesktopReturnEntry])

  const handleReturnPointerLeave = useCallback((event) => {
    if (!isDesktopPointer(event)) return
    beginWithdrawal({ reason: RETURN_ENTRY_WITHDRAWAL_REASON.LEAVE })
  }, [beginWithdrawal])

  const handleTouchReturn = useCallback((event) => {
    if (event.pointerType !== 'touch' || !interactive) return
    if (!mobileReturnArmed) setMobileReturnArmed(true)
  }, [interactive, mobileReturnArmed])

  const handleReturnTextRevealed = useCallback((generation) => {
    if (
      returnEntryGenerationRef.current === generation
      && returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.TEXT
    ) {
      transitionReturnEntry(RETURN_ENTRY_PHASE.ARROW)
    }
  }, [transitionReturnEntry])

  const handleReturnTextWithdrawn = useCallback((generation) => {
    if (
      returnEntryGenerationRef.current === generation
      && returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.WITHDRAW_TEXT
    ) resetReturnEntry()
  }, [resetReturnEntry])

  const handleAnimationEnd = useCallback((event) => {
    if (event.animationName === 'updates-return-arrow-reveal') {
      if (returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.ARROW) {
        transitionReturnEntry(RETURN_ENTRY_PHASE.RING)
      }
      return
    }

    if (event.animationName === 'updates-return-ring-draw') {
      if (returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.RING) {
        transitionReturnEntry(RETURN_ENTRY_PHASE.READY)
      } else if (
        returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.HIDDEN
        && mobileReturnArmed
      ) {
        setMobileReturnReady(true)
      }
      return
    }

    if (
      (phase === UPDATES_PHASE.ENTER_SURFACE && event.animationName === 'updates-page-enter')
      || (phase === UPDATES_PHASE.RETURN_SURFACE && event.animationName === 'updates-page-return')
    ) onSurfaceComplete()
  }, [mobileReturnArmed, onSurfaceComplete, phase, transitionReturnEntry])

  const handleTransitionEnd = useCallback((event) => {
    if (returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.WITHDRAW_RING
      && event.propertyName === 'stroke-dashoffset'
      && event.target.classList.contains('landing-entry-ring')) {
      advanceWithdrawalStage(RETURN_ENTRY_PHASE.WITHDRAW_RING)
      return
    }
    if (returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.WITHDRAW_ARROW
      && event.propertyName === 'opacity'
      && event.target.classList.contains('landing-entry-arrow__ink')) {
      advanceWithdrawalStage(RETURN_ENTRY_PHASE.WITHDRAW_ARROW)
    }
  }, [advanceWithdrawalStage])

  if (!visible) return null

  const desktopReturnActive = returnEntryPhase !== RETURN_ENTRY_PHASE.HIDDEN
  const returnTextActive = desktopReturnActive
  const renderedReturnEntryGeneration = returnEntryGenerationRef.current
  const renderedReturnEntryInstance = returnEntryInstanceRef.current
  const ringActive = returnEntryPhase === RETURN_ENTRY_PHASE.RING
    || returnEntryPhase === RETURN_ENTRY_PHASE.READY
    || mobileReturnArmed

  return (
    <section
      className="landing-updates-page"
      data-updates-phase={phase}
      data-return-state={returnEntryPhase}
      data-return-generation={returnEntryGenerationRef.current}
      data-return-withdraw-origin={withdrawalOriginRef.current}
      data-return-withdraw-reason={withdrawalReasonRef.current || 'none'}
      data-return-armed={mobileReturnArmed ? 'true' : 'false'}
      data-return-ready={mobileReturnReady ? 'true' : 'false'}
      onAnimationEnd={handleAnimationEnd}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="landing-updates-page__return-backdrop" aria-hidden="true" />
      <div className="landing-updates-page__placeholder">更新公告</div>
      <div
        ref={returnTriggerRef}
        className="landing-updates-return-trigger"
        onPointerEnter={handleReturnPointerEnter}
        onPointerLeave={handleReturnPointerLeave}
      >
        <button
          type="button"
          className="landing-updates-return"
          aria-label="返回 NewTone"
          aria-expanded={desktopReturnActive ? 'true' : 'false'}
          onPointerDown={handleTouchReturn}
        >
          <span className="landing-updates-return__label">
            {returnTextActive ? (
              <ScrambleText
                key={`return-text-${renderedReturnEntryInstance}`}
                text="返回入口"
                active={returnTextActive}
                duration={760}
                onRevealed={() => handleReturnTextRevealed(renderedReturnEntryGeneration)}
                withdrawing={returnEntryPhase === RETURN_ENTRY_PHASE.WITHDRAW_TEXT}
                withdrawalDuration={withdrawalTimingRef.current.text}
                onWithdrawn={() => handleReturnTextWithdrawn(renderedReturnEntryGeneration)}
              />
            ) : '返回入口'}
          </span>
          <LandingEntryArrow
            key={`return-arrow-${renderedReturnEntryInstance}`}
            className="landing-updates-return__arrow"
            direction="up"
            phase="steady"
            ringActive={ringActive}
            delayedBob={returnEntryPhase === RETURN_ENTRY_PHASE.READY || mobileReturnReady}
            arrowDelayed={mobileReturnArmed && !mobileReturnReady}
          />
        </button>
      </div>
    </section>
  )
}

export default LandingUpdatesPage
