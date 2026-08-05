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

export function createReaderNavigationState(location, content) {
  const resolved = resolvePosition(location, content)
  return {
    committedLocation: resolved,
    displayLocation: resolved,
    transitionFrom: null,
    transitionTarget: null,
    transitionKind: null,
  }
}

export function syncReaderNavigation(state, location, content) {
  const target = resolvePosition(location, content)
  if (
    target.phaseId === state.displayLocation.phaseId
    && target.pageId === state.displayLocation.pageId
    && target.beatIndex === state.displayLocation.beatIndex
    && !state.transitionTarget
  ) return state
  return {
    committedLocation: target,
    displayLocation: target,
    transitionFrom: null,
    transitionTarget: null,
    transitionKind: null,
  }
}

export function beginReaderNavigation(state, intent, { reducedMotion = false, content } = {}) {
  const steps = intent === READER_INTENTS.FORWARD ? 1 : -1
  return retargetReaderNavigation(state, steps, { reducedMotion, content })
}

export function retargetReaderNavigation(state, steps, { reducedMotion = false, content } = {}) {
  if (!Number.isInteger(steps) || steps === 0) return state
  let target = state.displayLocation
  const getNext = steps > 0 ? nextPosition : previousPosition
  for (let count = 0; count < Math.abs(steps); count += 1) {
    const candidate = getNext(target, content)
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

export function targetReaderNavigation(state, location, { reducedMotion = false, content } = {}) {
  const target = resolvePosition(location, content)
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
