import { useCallback, useEffect, useReducer, useRef } from 'react'
import LandingUpdatesReturnEntry from './landing/LandingUpdatesReturnEntry'
import {
  resolveUpdatesTouchIntent,
  resolveUpdatesWheelIntent,
  UPDATE_RETURN_INTENTS,
  UPDATES_PHASE,
} from '../landing/landingUpdatesFlow'
import {
  createUpdatesReturnFlowState,
  reduceUpdatesReturnFlow,
  UPDATES_RETURN_EVENT,
  UPDATES_RETURN_REASON,
  UPDATES_RETURN_STATE,
} from '../landing/landingUpdatesReturnFlow'
import './LandingUpdatesPage.css'

function isDesktopPointer(event) {
  return ['mouse', 'pen'].includes(event.pointerType)
}

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function LandingUpdatesPage({ phase, onSurfaceComplete, onReturnRequested }) {
  const [returnFlow, dispatchReturn] = useReducer(
    reduceUpdatesReturnFlow,
    undefined,
    createUpdatesReturnFlowState,
  )
  const returnFlowRef = useRef(returnFlow)
  const returnTriggerRef = useRef(null)
  const touchGestureRef = useRef(null)
  const navigationIssuedRef = useRef(false)
  const visible = phase !== UPDATES_PHASE.LANDING
  const interactive = phase === UPDATES_PHASE.UPDATES

  returnFlowRef.current = returnFlow

  const emitReturn = useCallback(event => dispatchReturn(event), [])

  useEffect(() => {
    if (phase === UPDATES_PHASE.LANDING) {
      touchGestureRef.current = null
      navigationIssuedRef.current = false
      dispatchReturn({ type: UPDATES_RETURN_EVENT.RESET })
      return
    }
    if (!interactive) {
      touchGestureRef.current = null
      dispatchReturn({ type: UPDATES_RETURN_EVENT.RESET })
    }
  }, [interactive, phase])

  useEffect(() => {
    if (!interactive || !isCoarsePointer()) return undefined
    const frame = window.requestAnimationFrame(() => {
      if (returnFlowRef.current.state === UPDATES_RETURN_STATE.HIDDEN) {
        emitReturn({ type: UPDATES_RETURN_EVENT.SURFACE_STABLE })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [emitReturn, interactive])

  useEffect(() => {
    if (!interactive) return undefined
    const onWheel = event => {
      const state = returnFlowRef.current
      const intent = resolveUpdatesWheelIntent({
        isCoarse: isCoarsePointer(),
        phase: state.state,
        armed: state.armed,
        ready: state.state === UPDATES_RETURN_STATE.READY,
        deltaY: event.deltaY,
      })
      if (intent === UPDATE_RETURN_INTENTS.RETURN) {
        if (event.cancelable) event.preventDefault()
        emitReturn({
          type: UPDATES_RETURN_EVENT.WHEEL_RETURN,
          reason: UPDATES_RETURN_REASON.WHEEL,
          returnToLanding: true,
        })
      } else if (intent === UPDATE_RETURN_INTENTS.CANCEL) {
        if (event.cancelable) event.preventDefault()
        emitReturn({ type: UPDATES_RETURN_EVENT.WHEEL_CANCEL })
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [emitReturn, interactive])

  useEffect(() => {
    if (!interactive) return undefined
    const onGlobalPointerDown = event => {
      if (isDesktopPointer(event)) {
        const state = returnFlowRef.current
        if (state.state !== UPDATES_RETURN_STATE.HIDDEN
          && !returnTriggerRef.current?.contains(event.target)) {
          emitReturn({
            type: UPDATES_RETURN_EVENT.POINTER_LEAVE,
            reason: UPDATES_RETURN_REASON.OUTSIDE,
          })
        }
        return
      }
      if (['touch', 'pen'].includes(event.pointerType)) {
        touchGestureRef.current = { pointerId: event.pointerId, startY: event.clientY }
      }
    }
    const onPointerMove = event => {
      const gesture = touchGestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      const state = returnFlowRef.current
      const intent = resolveUpdatesTouchIntent({
        armed: state.armed,
        ready: state.state === UPDATES_RETURN_STATE.READY,
        startY: gesture.startY,
        endY: event.clientY,
      })
      if (intent === UPDATE_RETURN_INTENTS.RETURN) {
        touchGestureRef.current = null
        if (event.cancelable) event.preventDefault()
        emitReturn({
          type: UPDATES_RETURN_EVENT.SWIPE_RETURN,
          reason: UPDATES_RETURN_REASON.WHEEL,
          returnToLanding: true,
        })
      } else if (intent === UPDATE_RETURN_INTENTS.CANCEL) {
        touchGestureRef.current = null
        emitReturn({ type: UPDATES_RETURN_EVENT.SWIPE_CANCEL })
      }
    }
    const clearGesture = event => {
      const gesture = touchGestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      touchGestureRef.current = null
      const state = returnFlowRef.current
      if (state.armed
        && state.state === UPDATES_RETURN_STATE.READY
        && Math.abs(gesture.startY - event.clientY) < 42) {
        emitReturn({ type: UPDATES_RETURN_EVENT.SWIPE_CANCEL })
      }
    }
    window.addEventListener('pointerdown', onGlobalPointerDown, { capture: true, passive: true })
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
    window.addEventListener('pointerup', clearGesture, { capture: true, passive: true })
    window.addEventListener('pointercancel', clearGesture, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', onGlobalPointerDown, { capture: true })
      window.removeEventListener('pointermove', onPointerMove, { capture: true })
      window.removeEventListener('pointerup', clearGesture, { capture: true })
      window.removeEventListener('pointercancel', clearGesture, { capture: true })
    }
  }, [emitReturn, interactive])

  useEffect(() => {
    if (returnFlow.effect !== 'navigation-ready' || navigationIssuedRef.current) return
    navigationIssuedRef.current = true
    onReturnRequested()
  }, [onReturnRequested, returnFlow.effect])

  const handlePointerEnter = useCallback(event => {
    if (!interactive || !isDesktopPointer(event)) return
    if (returnFlowRef.current.state === UPDATES_RETURN_STATE.HIDDEN) {
      emitReturn({ type: UPDATES_RETURN_EVENT.POINTER_ENTER })
    }
  }, [emitReturn, interactive])

  const handlePointerLeave = useCallback(event => {
    if (!interactive || !isDesktopPointer(event)) return
    const state = returnFlowRef.current.state
    if ([
      UPDATES_RETURN_STATE.HIDDEN,
      UPDATES_RETURN_STATE.WITHDRAW_ARROW_TURN,
      UPDATES_RETURN_STATE.WITHDRAW_ARROW,
      UPDATES_RETURN_STATE.WITHDRAW_TEXT,
    ].includes(state)) return
    emitReturn({
      type: UPDATES_RETURN_EVENT.POINTER_LEAVE,
      reason: UPDATES_RETURN_REASON.LEAVE,
    })
  }, [emitReturn, interactive])

  const handlePointerDown = useCallback(event => {
    if (!interactive || !['touch', 'pen'].includes(event.pointerType)) return
    if (returnFlowRef.current.state === UPDATES_RETURN_STATE.ARROW_REVEAL) {
      emitReturn({ type: UPDATES_RETURN_EVENT.MOBILE_TAP })
    }
  }, [emitReturn, interactive])

  const handleAnimationEnd = useCallback(event => {
    if (event.animationName === 'updates-return-arrow-reveal'
      && !isCoarsePointer()
      && returnFlowRef.current.state === UPDATES_RETURN_STATE.ARROW_REVEAL) {
      emitReturn({ type: UPDATES_RETURN_EVENT.ARROW_READY })
      return
    }
    if (event.animationName === 'updates-return-arrow-withdraw'
      && returnFlowRef.current.state === UPDATES_RETURN_STATE.WITHDRAW_ARROW) {
      emitReturn({ type: UPDATES_RETURN_EVENT.WITHDRAW_ANIMATION_COMPLETE })
      return
    }
    if (
      (phase === UPDATES_PHASE.ENTER_SURFACE && event.animationName === 'updates-page-enter')
      || (phase === UPDATES_PHASE.RETURN_SURFACE && event.animationName === 'updates-page-return')
    ) onSurfaceComplete()
  }, [emitReturn, onSurfaceComplete, phase])

  const handleTransitionEnd = useCallback(event => {
    if (event.propertyName !== 'transform'
      || !event.target.classList.contains('landing-entry-arrow__rotator')) return
    if (returnFlowRef.current.state === UPDATES_RETURN_STATE.ARROW_TURN) {
      emitReturn({ type: UPDATES_RETURN_EVENT.ARROW_TURNED })
      return
    }
    if (returnFlowRef.current.state === UPDATES_RETURN_STATE.WITHDRAW_ARROW_TURN) {
      emitReturn({ type: UPDATES_RETURN_EVENT.WITHDRAW_ANIMATION_COMPLETE })
    }
  }, [emitReturn])

  if (!visible) return null

  return (
    <section
      className="landing-updates-page paper-surface"
      data-updates-phase={phase}
      data-return-state={returnFlow.state}
      data-return-generation={returnFlow.instanceId}
      data-return-withdraw-reason={returnFlow.reason || 'none'}
      data-return-armed={returnFlow.armed ? 'true' : 'false'}
      data-return-ready={returnFlow.state === UPDATES_RETURN_STATE.READY ? 'true' : 'false'}
      onAnimationEnd={handleAnimationEnd}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="landing-updates-page__return-backdrop" aria-hidden="true" />
      <div className="landing-updates-page__placeholder">更新公告</div>
      <LandingUpdatesReturnEntry
        flow={returnFlow}
        triggerRef={returnTriggerRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onAnimationEnd={handleAnimationEnd}
        onTransitionEnd={handleTransitionEnd}
        onTextRevealed={() => {
          if (returnFlowRef.current.state === UPDATES_RETURN_STATE.TEXT_REVEAL) {
            emitReturn({ type: UPDATES_RETURN_EVENT.TEXT_REVEALED })
          }
        }}
        onTextWithdrawn={() => {
          if (returnFlowRef.current.state === UPDATES_RETURN_STATE.WITHDRAW_TEXT) {
            emitReturn({ type: UPDATES_RETURN_EVENT.WITHDRAW_ANIMATION_COMPLETE })
          }
        }}
      />
    </section>
  )
}

export default LandingUpdatesPage
