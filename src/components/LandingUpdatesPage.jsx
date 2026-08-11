import { useCallback, useEffect, useRef, useState } from 'react'
import LandingEntryArrow from './landing/LandingEntryArrow'
import { resolveTouchReturnSwipe, UPDATES_PHASE } from '../landing/landingUpdatesFlow'
import './LandingUpdatesPage.css'

function LandingUpdatesPage({ phase, onSurfaceComplete, onReturnRequested }) {
  const [returnArmed, setReturnArmed] = useState(false)
  const [returnReady, setReturnReady] = useState(false)
  const touchGestureRef = useRef(null)

  const visible = phase !== UPDATES_PHASE.LANDING
  const interactive = phase === UPDATES_PHASE.UPDATES

  useEffect(() => {
    if (!interactive) {
      setReturnArmed(false)
      setReturnReady(false)
      touchGestureRef.current = null
    }
  }, [interactive])

  useEffect(() => {
    if (!interactive) return undefined
    const onWheel = (event) => {
      if (event.deltaY < -8 && returnReady) onReturnRequested()
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [interactive, onReturnRequested, returnReady])

  useEffect(() => {
    if (!interactive || !returnReady) return undefined

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
        armed: returnArmed,
        ready: returnReady,
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
  }, [interactive, onReturnRequested, returnArmed, returnReady])

  const handlePointerMove = useCallback((event) => {
    if (!interactive || event.pointerType === 'touch') return
    if (event.clientY <= 24) setReturnArmed(true)
  }, [interactive])

  const handleTouchReturn = useCallback((event) => {
    if (event.pointerType !== 'touch' || !interactive) return
    if (!returnArmed) setReturnArmed(true)
  }, [interactive, returnArmed])

  const handleAnimationEnd = useCallback((event) => {
    if (event.animationName === 'updates-return-ring-draw') setReturnReady(true)
    if (
      (phase === UPDATES_PHASE.ENTER_SURFACE && event.animationName === 'updates-page-enter')
      || (phase === UPDATES_PHASE.RETURN_SURFACE && event.animationName === 'updates-page-return')
    ) onSurfaceComplete()
  }, [onSurfaceComplete, phase])

  if (!visible) return null

  return (
    <section
      className="landing-updates-page paper-surface"
      data-updates-phase={phase}
      data-return-armed={returnArmed ? 'true' : 'false'}
      data-return-ready={returnReady ? 'true' : 'false'}
      onPointerMove={handlePointerMove}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="landing-updates-page__placeholder">更新公告</div>
      <button
        type="button"
        className="landing-updates-return"
        aria-label="返回 NewTone"
        onPointerDown={handleTouchReturn}
      >
        <span className="landing-updates-return__label">返回入口</span>
        <LandingEntryArrow
          className="landing-updates-return__arrow"
          direction="up"
          phase="steady"
          ringActive={returnArmed}
          delayedBob={returnReady}
          arrowDelayed={!returnReady}
        />
      </button>
    </section>
  )
}

export default LandingUpdatesPage
