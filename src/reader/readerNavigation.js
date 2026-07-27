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
    transitionFrom: null,
    transitionTarget: null,
    transitionKind: null,
  }
}

export function syncReaderNavigation(state, location) {
  const target = resolvePosition(location)
  if (target.linearIndex === state.displayLocation.linearIndex && !state.transitionTarget) return state
  return {
    committedLocation: target,
    displayLocation: target,
    transitionFrom: null,
    transitionTarget: null,
    transitionKind: null,
  }
}

export function beginReaderNavigation(state, intent, { reducedMotion = false } = {}) {
  const steps = intent === READER_INTENTS.FORWARD ? 1 : -1
  return retargetReaderNavigation(state, steps, { reducedMotion })
}

export function retargetReaderNavigation(state, steps, { reducedMotion = false } = {}) {
  if (!Number.isInteger(steps) || steps === 0) return state
  let target = state.displayLocation
  const getNext = steps > 0 ? nextPosition : previousPosition
  for (let count = 0; count < Math.abs(steps); count += 1) {
    const candidate = getNext(target)
    if (!candidate) break
    target = candidate
  }
  if (!target) return state
  if (target.linearIndex === state.displayLocation.linearIndex) return state

  const transitionKind = getReaderTransitionKind(state.displayLocation, target)
  if (reducedMotion) {
    return {
      committedLocation: target,
      displayLocation: target,
      transitionFrom: null,
      transitionTarget: null,
      transitionKind,
    }
  }

  return {
    ...state,
    displayLocation: target,
    transitionFrom: state.displayLocation,
    transitionTarget: target,
    transitionKind,
  }
}

export function targetReaderNavigation(state, location, { reducedMotion = false } = {}) {
  const target = resolvePosition(location)
  if (target.linearIndex === state.displayLocation.linearIndex) return state
  const transitionKind = getReaderTransitionKind(state.displayLocation, target)
  if (reducedMotion) {
    return {
      committedLocation: target,
      displayLocation: target,
      transitionFrom: null,
      transitionTarget: null,
      transitionKind,
    }
  }
  return {
    ...state,
    displayLocation: target,
    transitionFrom: state.displayLocation,
    transitionTarget: target,
    transitionKind,
  }
}

export function finishReaderNavigation(state) {
  if (!state.transitionTarget) return state
  return {
    committedLocation: state.transitionTarget,
    displayLocation: state.transitionTarget,
    transitionFrom: null,
    transitionTarget: null,
    transitionKind: null,
  }
}
