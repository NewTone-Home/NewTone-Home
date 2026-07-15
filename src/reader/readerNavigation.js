import { READER_INTENTS } from './readerInput'
import { nextPosition, previousPosition, resolvePosition } from './readerPosition'

export const READER_TRANSITIONS = Object.freeze({
  BEAT: 'beat',
  PAGE: 'page',
  PHASE: 'phase',
})

export function getReaderTransitionKind(current, target) {
  if (current.phaseId !== target.phaseId) return READER_TRANSITIONS.PHASE
  if (current.pageId !== target.pageId) return READER_TRANSITIONS.PAGE
  return READER_TRANSITIONS.BEAT
}

export function createReaderNavigationState(location) {
  const resolved = resolvePosition(location)
  return {
    committedLocation: resolved,
    displayLocation: resolved,
    transitionTarget: null,
    transitionKind: null,
  }
}

export function beginReaderNavigation(state, intent, { reducedMotion = false } = {}) {
  if (state.transitionTarget) return state
  const target = intent === READER_INTENTS.FORWARD
    ? nextPosition(state.displayLocation)
    : previousPosition(state.displayLocation)
  if (!target) return state

  const transitionKind = getReaderTransitionKind(state.displayLocation, target)
  if (reducedMotion) {
    return {
      committedLocation: target,
      displayLocation: target,
      transitionTarget: null,
      transitionKind,
    }
  }

  return {
    ...state,
    displayLocation: target,
    transitionTarget: target,
    transitionKind,
  }
}

export function finishReaderNavigation(state) {
  if (!state.transitionTarget) return state
  return {
    committedLocation: state.transitionTarget,
    displayLocation: state.transitionTarget,
    transitionTarget: null,
    transitionKind: null,
  }
}
