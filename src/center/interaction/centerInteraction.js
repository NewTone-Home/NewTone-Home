export const CENTER_INTERACTION_MODE = Object.freeze({
  IDLE: 'idle',
  FOCUS: 'focus',
  SELECTED: 'selected',
  OPEN: 'open',
})

export const initialCenterInteraction = Object.freeze({
  mode: CENTER_INTERACTION_MODE.IDLE,
  focusedId: null,
  selectedId: null,
  openId: null,
})

export function resolveEntityVisualState(state, entityId) {
  if (state.openId === entityId) return CENTER_INTERACTION_MODE.OPEN
  if (state.selectedId === entityId) return CENTER_INTERACTION_MODE.SELECTED
  if (state.focusedId === entityId) return CENTER_INTERACTION_MODE.FOCUS
  return CENTER_INTERACTION_MODE.IDLE
}

export function centerInteractionReducer(state, event) {
  switch (event.type) {
    case 'FOCUS':
      if (!event.entityId || state.selectedId === event.entityId) return state
      return { ...state, mode: state.openId ? CENTER_INTERACTION_MODE.OPEN : state.selectedId ? CENTER_INTERACTION_MODE.SELECTED : CENTER_INTERACTION_MODE.FOCUS, focusedId: event.entityId }
    case 'BLUR':
      if (state.focusedId !== event.entityId) return state
      return {
        ...state,
        mode: state.openId ? CENTER_INTERACTION_MODE.OPEN : state.selectedId ? CENTER_INTERACTION_MODE.SELECTED : CENTER_INTERACTION_MODE.IDLE,
        focusedId: null,
      }
    case 'SELECT':
      if (!event.entityId) return state
      return { mode: CENTER_INTERACTION_MODE.SELECTED, focusedId: null, selectedId: event.entityId, openId: null }
    case 'OPEN': {
      const entityId = event.entityId || state.selectedId
      if (!entityId) return state
      return { mode: CENTER_INTERACTION_MODE.OPEN, focusedId: null, selectedId: entityId, openId: entityId }
    }
    case 'CLOSE_OPEN':
      if (!state.selectedId) return { ...initialCenterInteraction }
      return { ...state, mode: CENTER_INTERACTION_MODE.SELECTED, openId: null }
    case 'CLEAR':
      return { ...initialCenterInteraction }
    default:
      return state
  }
}

