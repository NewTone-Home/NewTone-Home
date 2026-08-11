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
  WITHDRAWING: 'withdrawing',
})

const RETURN_ENTRY_WITHDRAWAL_FALLBACK_MS = 520

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
  const withdrawalOriginRef = useRef(RETURN_ENTRY_PHASE.HIDDEN)
  const withdrawalPartsRef = useRef(new Set())
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
    withdrawalPartsRef.current = new Set()
    returnEntryPhaseRef.current = RETURN_ENTRY_PHASE.HIDDEN
    setReturnEntryPhase(RETURN_ENTRY_PHASE.HIDDEN)
    setMobileReturnArmed(false)
    setMobileReturnReady(false)
    touchGestureRef.current = null
  }, [clearWithdrawalTimer])

  const markWithdrawalPart = useCallback((part) => {
    if (returnEntryPhaseRef.current !== RETURN_ENTRY_PHASE.WITHDRAWING) return
    withdrawalPartsRef.current.add(part)
    if (['text', 'arrow', 'ring'].every(key => withdrawalPartsRef.current.has(key))) {
      resetReturnEntry()
    }
  }, [resetReturnEntry])

  const beginWithdrawal = useCallback(({ returnToLanding = false } = {}) => {
    if (!interactive) return

    const currentPhase = returnEntryPhaseRef.current
    if (currentPhase === RETURN_ENTRY_PHASE.HIDDEN) {
      if (returnToLanding) onReturnRequested()
      return
    }
    if (currentPhase === RETURN_ENTRY_PHASE.WITHDRAWING) {
      if (returnToLanding) onReturnRequested()
      return
    }

    clearWithdrawalTimer()
    returnEntryGenerationRef.current += 1
    withdrawalOriginRef.current = currentPhase
    withdrawalPartsRef.current = new Set(
      currentPhase === RETURN_ENTRY_PHASE.TEXT
        ? ['arrow', 'ring']
        : currentPhase === RETURN_ENTRY_PHASE.ARROW
          ? ['ring']
          : [],
    )
    transitionReturnEntry(RETURN_ENTRY_PHASE.WITHDRAWING)
    withdrawalTimerRef.current = window.setTimeout(() => {
      if (returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.WITHDRAWING) resetReturnEntry()
    }, RETURN_ENTRY_WITHDRAWAL_FALLBACK_MS)

    if (returnToLanding) onReturnRequested()
  }, [clearWithdrawalTimer, interactive, onReturnRequested, resetReturnEntry, transitionReturnEntry])

  const beginDesktopReturnEntry = useCallback(() => {
    if (!interactive) return
    if (
      returnEntryPhaseRef.current !== RETURN_ENTRY_PHASE.HIDDEN
      && returnEntryPhaseRef.current !== RETURN_ENTRY_PHASE.WITHDRAWING
    ) return

    clearWithdrawalTimer()
    returnEntryGenerationRef.current += 1
    withdrawalOriginRef.current = RETURN_ENTRY_PHASE.HIDDEN
    withdrawalPartsRef.current = new Set()
    transitionReturnEntry(RETURN_ENTRY_PHASE.TEXT)
  }, [clearWithdrawalTimer, interactive, transitionReturnEntry])

  useEffect(() => {
    if (!interactive) resetReturnEntry()
  }, [interactive, resetReturnEntry])

  useEffect(() => {
    if (!interactive) return undefined

    const onWheel = (event) => {
      const currentPhase = returnEntryPhaseRef.current
      const desktopReturnActive = currentPhase !== RETURN_ENTRY_PHASE.HIDDEN

      if (desktopReturnActive) {
        beginWithdrawal({
          returnToLanding: currentPhase === RETURN_ENTRY_PHASE.READY && event.deltaY < -8,
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
      beginWithdrawal()
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
    beginWithdrawal()
  }, [beginWithdrawal])

  const handleTouchReturn = useCallback((event) => {
    if (event.pointerType !== 'touch' || !interactive) return
    if (!mobileReturnArmed) setMobileReturnArmed(true)
  }, [interactive, mobileReturnArmed])

  const handleReturnTextRevealed = useCallback(() => {
    if (returnEntryPhaseRef.current === RETURN_ENTRY_PHASE.TEXT) {
      transitionReturnEntry(RETURN_ENTRY_PHASE.ARROW)
    }
  }, [transitionReturnEntry])

  const handleReturnTextWithdrawn = useCallback(() => {
    markWithdrawalPart('text')
  }, [markWithdrawalPart])

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
  }, [markWithdrawalPart, mobileReturnArmed, onSurfaceComplete, phase, transitionReturnEntry])

  const handleTransitionEnd = useCallback((event) => {
    if (returnEntryPhaseRef.current !== RETURN_ENTRY_PHASE.WITHDRAWING) return
    if (
      event.propertyName === 'opacity'
      && event.target.classList.contains('landing-entry-arrow__ink')
    ) {
      markWithdrawalPart('arrow')
      return
    }
    if (
      event.propertyName === 'stroke-dashoffset'
      && event.target.classList.contains('landing-entry-ring')
    ) {
      markWithdrawalPart('ring')
    }
  }, [markWithdrawalPart])

  if (!visible) return null

  const desktopReturnActive = returnEntryPhase !== RETURN_ENTRY_PHASE.HIDDEN
  const returnTextActive = desktopReturnActive
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
                text="返回入口"
                active={returnTextActive}
                duration={760}
                onRevealed={handleReturnTextRevealed}
                withdrawing={returnEntryPhase === RETURN_ENTRY_PHASE.WITHDRAWING}
                onWithdrawn={handleReturnTextWithdrawn}
              />
            ) : '返回入口'}
          </span>
          <LandingEntryArrow
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
