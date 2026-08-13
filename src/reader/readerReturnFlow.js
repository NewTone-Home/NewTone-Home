export const READER_RETURN_STATE = Object.freeze({
  HIDDEN: 'hidden',
  REVEALING: 'revealing',
  READY: 'ready',
  ARMED: 'armed',
  DISMISSING: 'dismissing',
})

export const READER_RETURN_EVENT = Object.freeze({
  LAST_CONTENT_REACHED: 'last-content-reached',
  BOUNDARY_REACHED: 'boundary-reached',
  RETURN_TEXT_STABLE: 'return-text-stable',
  RETURN_ARROW_READY: 'return-arrow-ready',
  ACTIVATE: 'activate',
  ARM: 'arm',
  CANCEL: 'cancel',
  DISARM: 'disarm',
  FORWARD_GESTURE: 'forward-gesture',
  REVERSE_GESTURE: 'reverse-gesture',
  DISMISS_STARTED: 'dismiss-started',
  DISMISS_COMPLETED: 'dismiss-completed',
  NAVIGATION_COMPLETED: 'navigation-completed',
  EXIT_COMPLETE: 'exit-complete',
  RESET: 'reset',
})

export function createReaderReturnFlowState() {
  return Object.freeze({
    state: READER_RETURN_STATE.HIDDEN,
    effect: null,
    returnToLanding: false,
    dismissed: false,
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

export function reduceReaderReturnFlow(current, event) {
  const flow = current ?? createReaderReturnFlowState()
  const type = typeof event === 'string' ? event : event?.type
  const atBottom = type === READER_RETURN_EVENT.LAST_CONTENT_REACHED
    || (typeof event === 'object' && event.atBottom === true)

  if (type === READER_RETURN_EVENT.RESET) return createReaderReturnFlowState()

  switch (flow.state) {
    case READER_RETURN_STATE.HIDDEN:
      if (![READER_RETURN_EVENT.BOUNDARY_REACHED,
        READER_RETURN_EVENT.LAST_CONTENT_REACHED].includes(type)) return flow
      if (!atBottom && flow.dismissed) return next(flow, READER_RETURN_STATE.HIDDEN, { dismissed: false })
      if (!atBottom || flow.dismissed) return flow
      return next(flow, READER_RETURN_STATE.REVEALING, {
        effect: 'entry-visible',
        dismissed: false,
        returnToLanding: false,
        instanceId: flow.instanceId + 1,
      })
    case READER_RETURN_STATE.REVEALING:
      if ([READER_RETURN_EVENT.RETURN_TEXT_STABLE,
        READER_RETURN_EVENT.RETURN_ARROW_READY].includes(type)) {
        return next(flow, READER_RETURN_STATE.READY)
      }
      if ([READER_RETURN_EVENT.ARM, READER_RETURN_EVENT.ACTIVATE].includes(type)) {
        return next(flow, READER_RETURN_STATE.ARMED, { effect: 'armed' })
      }
      if ([READER_RETURN_EVENT.REVERSE_GESTURE,
        READER_RETURN_EVENT.DISMISS_STARTED].includes(type)) {
        return next(flow, READER_RETURN_STATE.DISMISSING, { effect: 'dismiss-start' })
      }
      return flow
    case READER_RETURN_STATE.READY:
      if ([READER_RETURN_EVENT.ARM, READER_RETURN_EVENT.ACTIVATE].includes(type)) {
        return next(flow, READER_RETURN_STATE.ARMED, { effect: 'armed' })
      }
      if ([READER_RETURN_EVENT.REVERSE_GESTURE,
        READER_RETURN_EVENT.DISMISS_STARTED].includes(type)) {
        return next(flow, READER_RETURN_STATE.DISMISSING, { effect: 'dismiss-start' })
      }
      return flow
    case READER_RETURN_STATE.ARMED:
      if ([READER_RETURN_EVENT.DISARM, READER_RETURN_EVENT.CANCEL].includes(type)) {
        return next(flow, READER_RETURN_STATE.READY)
      }
      if (type === READER_RETURN_EVENT.FORWARD_GESTURE) {
        return next(flow, READER_RETURN_STATE.DISMISSING, {
          effect: 'return-start',
          returnToLanding: true,
        })
      }
      if ([READER_RETURN_EVENT.REVERSE_GESTURE,
        READER_RETURN_EVENT.DISMISS_STARTED].includes(type)) {
        return next(flow, READER_RETURN_STATE.DISMISSING, { effect: 'dismiss-start' })
      }
      return flow
    case READER_RETURN_STATE.DISMISSING:
      if (![READER_RETURN_EVENT.EXIT_COMPLETE,
        READER_RETURN_EVENT.DISMISS_COMPLETED,
        READER_RETURN_EVENT.NAVIGATION_COMPLETED].includes(type)) return flow
      return next(flow, READER_RETURN_STATE.HIDDEN, {
        effect: flow.returnToLanding ? 'navigation-ready' : null,
        dismissed: !flow.returnToLanding,
      })
    default:
      return createReaderReturnFlowState()
  }
}
