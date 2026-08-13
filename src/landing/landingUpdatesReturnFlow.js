export const UPDATES_RETURN_STATE = Object.freeze({
  HIDDEN: 'hidden',
  TEXT_REVEAL: 'text',
  ARROW_REVEAL: 'arrow',
  ARROW_TURN: 'arrow-turn',
  READY: 'ready',
  WITHDRAW_ARROW_TURN: 'withdraw-arrow-turn',
  WITHDRAW_ARROW: 'withdraw-arrow',
  WITHDRAW_TEXT: 'withdraw-text',
})

export const UPDATES_RETURN_EVENT = Object.freeze({
  SURFACE_STABLE: 'surface-stable',
  BEGIN: 'begin',
  TEXT_REVEALED: 'text-revealed',
  ARROW_REVEALED: 'arrow-revealed',
  ARROW_READY: 'arrow-ready',
  ARROW_TURNED: 'arrow-turned',
  POINTER_ENTER: 'pointer-enter',
  POINTER_LEAVE: 'pointer-leave',
  MOBILE_ACTIVATE: 'mobile-activate',
  MOBILE_TAP: 'mobile-tap',
  WITHDRAW: 'withdraw',
  WHEEL_RETURN: 'wheel-return',
  WHEEL_CANCEL: 'wheel-cancel',
  SWIPE_RETURN: 'swipe-return',
  SWIPE_CANCEL: 'swipe-cancel',
  CANCEL: 'cancel',
  ARROW_TURN_COMPLETE: 'arrow-turn-complete',
  ARROW_WITHDRAWN: 'arrow-withdrawn',
  TEXT_WITHDRAWN: 'text-withdrawn',
  WITHDRAW_ANIMATION_COMPLETE: 'withdraw-animation-complete',
  RESET: 'reset',
})

export const UPDATES_RETURN_REASON = Object.freeze({
  LEAVE: 'leave',
  OUTSIDE: 'outside',
  WHEEL: 'wheel',
})

export function createUpdatesReturnFlowState() {
  return Object.freeze({
    state: UPDATES_RETURN_STATE.HIDDEN,
    effect: null,
    returnToLanding: false,
    armed: false,
    reason: null,
    instanceId: 0,
  })
}

function next(current, state, values = {}) {
  return {
    ...current,
    ...values,
    state,
    effect: values.effect ?? null,
  }
}

function begin(current) {
  return next(current, UPDATES_RETURN_STATE.TEXT_REVEAL, {
    effect: 'entry-visible',
    returnToLanding: false,
    armed: false,
    reason: null,
    instanceId: current.instanceId + 1,
  })
}

function beginWithdrawal(current, reason, returnToLanding = false) {
  const arrowVisible = [
    UPDATES_RETURN_STATE.ARROW_REVEAL,
    UPDATES_RETURN_STATE.ARROW_TURN,
    UPDATES_RETURN_STATE.READY,
  ].includes(current.state)

  return next(
    current,
    arrowVisible
      ? UPDATES_RETURN_STATE.WITHDRAW_ARROW_TURN
      : UPDATES_RETURN_STATE.WITHDRAW_TEXT,
    {
      effect: 'withdraw-start',
      reason,
      returnToLanding,
      armed: false,
    },
  )
}

export function reduceUpdatesReturnFlow(current, event) {
  const flow = current ?? createUpdatesReturnFlowState()
  const type = typeof event === 'string' ? event : event?.type
  const reason = typeof event === 'object' ? event.reason : undefined
  const returnToLanding = typeof event === 'object' && event.returnToLanding === true

  if (type === UPDATES_RETURN_EVENT.RESET) return createUpdatesReturnFlowState()

  switch (flow.state) {
    case UPDATES_RETURN_STATE.HIDDEN:
      return [
        UPDATES_RETURN_EVENT.BEGIN,
        UPDATES_RETURN_EVENT.SURFACE_STABLE,
        UPDATES_RETURN_EVENT.POINTER_ENTER,
      ].includes(type) ? begin(flow) : flow
    case UPDATES_RETURN_STATE.TEXT_REVEAL:
      if (type === UPDATES_RETURN_EVENT.TEXT_REVEALED) {
        return next(flow, UPDATES_RETURN_STATE.ARROW_REVEAL)
      }
      if ([UPDATES_RETURN_EVENT.WITHDRAW, UPDATES_RETURN_EVENT.POINTER_LEAVE,
        UPDATES_RETURN_EVENT.WHEEL_RETURN, UPDATES_RETURN_EVENT.SWIPE_RETURN].includes(type)) {
        return beginWithdrawal(flow, reason || UPDATES_RETURN_REASON.LEAVE, returnToLanding)
      }
      return flow
    case UPDATES_RETURN_STATE.ARROW_REVEAL:
      if ([UPDATES_RETURN_EVENT.ARROW_REVEALED, UPDATES_RETURN_EVENT.ARROW_READY].includes(type)) {
        return next(flow, UPDATES_RETURN_STATE.ARROW_TURN)
      }
      if ([UPDATES_RETURN_EVENT.MOBILE_ACTIVATE, UPDATES_RETURN_EVENT.MOBILE_TAP].includes(type)) {
        return next(flow, UPDATES_RETURN_STATE.ARROW_TURN, { effect: 'armed', armed: true })
      }
      if ([UPDATES_RETURN_EVENT.WITHDRAW, UPDATES_RETURN_EVENT.POINTER_LEAVE,
        UPDATES_RETURN_EVENT.WHEEL_RETURN, UPDATES_RETURN_EVENT.SWIPE_RETURN].includes(type)) {
        return beginWithdrawal(flow, reason || UPDATES_RETURN_REASON.LEAVE, returnToLanding)
      }
      return flow
    case UPDATES_RETURN_STATE.ARROW_TURN:
      if (type === UPDATES_RETURN_EVENT.ARROW_TURNED) {
        return next(flow, UPDATES_RETURN_STATE.READY, {
          effect: 'ready',
        })
      }
      if ([UPDATES_RETURN_EVENT.WITHDRAW, UPDATES_RETURN_EVENT.POINTER_LEAVE,
        UPDATES_RETURN_EVENT.WHEEL_RETURN, UPDATES_RETURN_EVENT.SWIPE_RETURN].includes(type)) {
        return beginWithdrawal(flow, reason || UPDATES_RETURN_REASON.LEAVE, returnToLanding)
      }
      return flow
    case UPDATES_RETURN_STATE.READY:
      if ([UPDATES_RETURN_EVENT.CANCEL, UPDATES_RETURN_EVENT.WHEEL_CANCEL,
        UPDATES_RETURN_EVENT.SWIPE_CANCEL].includes(type)) {
        return next(flow, UPDATES_RETURN_STATE.ARROW_REVEAL, { effect: 'cancel', armed: false })
      }
      if ([UPDATES_RETURN_EVENT.WITHDRAW, UPDATES_RETURN_EVENT.POINTER_LEAVE,
        UPDATES_RETURN_EVENT.WHEEL_RETURN, UPDATES_RETURN_EVENT.SWIPE_RETURN].includes(type)) {
        return beginWithdrawal(flow, reason || UPDATES_RETURN_REASON.WHEEL, returnToLanding)
      }
      return flow
    case UPDATES_RETURN_STATE.WITHDRAW_ARROW_TURN:
      if ([UPDATES_RETURN_EVENT.ARROW_TURN_COMPLETE,
        UPDATES_RETURN_EVENT.WITHDRAW_ANIMATION_COMPLETE].includes(type)) {
        return next(flow, UPDATES_RETURN_STATE.WITHDRAW_ARROW)
      }
      return flow
    case UPDATES_RETURN_STATE.WITHDRAW_ARROW:
      if ([UPDATES_RETURN_EVENT.ARROW_WITHDRAWN,
        UPDATES_RETURN_EVENT.WITHDRAW_ANIMATION_COMPLETE].includes(type)) {
        return next(flow, UPDATES_RETURN_STATE.WITHDRAW_TEXT)
      }
      return flow
    case UPDATES_RETURN_STATE.WITHDRAW_TEXT:
      if ([UPDATES_RETURN_EVENT.TEXT_WITHDRAWN,
        UPDATES_RETURN_EVENT.WITHDRAW_ANIMATION_COMPLETE].includes(type)) {
        return next(flow, UPDATES_RETURN_STATE.HIDDEN, {
          effect: flow.returnToLanding ? 'navigation-ready' : null,
        })
      }
      return flow
    default:
      return createUpdatesReturnFlowState()
  }
}

export function isUpdatesReturnWithdrawal(state) {
  return [
    UPDATES_RETURN_STATE.WITHDRAW_ARROW_TURN,
    UPDATES_RETURN_STATE.WITHDRAW_ARROW,
    UPDATES_RETURN_STATE.WITHDRAW_TEXT,
  ].includes(state)
}
