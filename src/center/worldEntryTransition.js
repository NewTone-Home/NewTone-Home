export const WORLD_ENTRY_PHASE = Object.freeze({
  IDLE: 'idle',
  COVERING: 'covering',
  COVERED: 'covered',
  REVEALING: 'revealing',
  ACTIVE: 'active',
})

export const WORLD_ENTRY_INITIAL_STATE = Object.freeze({
  phase: WORLD_ENTRY_PHASE.IDLE,
  coverComplete: false,
  sceneReady: false,
})

function advanceWhenReady(state, nextState) {
  if (
    nextState.coverComplete
    && nextState.sceneReady
    && nextState.phase !== WORLD_ENTRY_PHASE.ACTIVE
    && nextState.phase !== WORLD_ENTRY_PHASE.REVEALING
  ) {
    return { ...nextState, phase: WORLD_ENTRY_PHASE.REVEALING }
  }
  return nextState
}

export function worldEntryReducer(state, action) {
  switch (action.type) {
    case 'start':
      if (state.phase !== WORLD_ENTRY_PHASE.IDLE) return state
      return {
        phase: WORLD_ENTRY_PHASE.COVERING,
        coverComplete: false,
        sceneReady: false,
      }
    case 'cover-complete':
      return advanceWhenReady(state, {
        ...state,
        phase: state.sceneReady ? WORLD_ENTRY_PHASE.REVEALING : WORLD_ENTRY_PHASE.COVERED,
        coverComplete: true,
      })
    case 'scene-ready':
      return advanceWhenReady(state, {
        ...state,
        phase: state.coverComplete ? WORLD_ENTRY_PHASE.REVEALING : state.phase,
        sceneReady: true,
      })
    case 'reveal-complete':
      return state.phase === WORLD_ENTRY_PHASE.REVEALING
        ? { ...state, phase: WORLD_ENTRY_PHASE.ACTIVE }
        : state
    case 'reset':
      return WORLD_ENTRY_INITIAL_STATE
    default:
      return state
  }
}
