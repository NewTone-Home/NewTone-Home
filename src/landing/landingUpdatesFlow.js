export const UPDATES_PHASE = Object.freeze({
  LANDING: 'landing',
  ENTER_ARROW_TURN: 'enter-arrow-turn',
  ENTER_ARROWS: 'enter-arrows',
  ENTER_LABELS: 'enter-labels',
  ENTER_SURFACE: 'enter-surface',
  UPDATES: 'updates',
  RETURN_SURFACE: 'return-surface',
  RETURN_LABELS: 'return-labels',
  RETURN_ARROWS: 'return-arrows',
  RETURN_ARROW_TURN: 'return-arrow-turn',
})

const TRANSITIONS = Object.freeze({
  [`${UPDATES_PHASE.LANDING}:enter-requested`]: UPDATES_PHASE.ENTER_ARROW_TURN,
  [`${UPDATES_PHASE.ENTER_ARROW_TURN}:turns-complete`]: UPDATES_PHASE.ENTER_ARROWS,
  [`${UPDATES_PHASE.ENTER_ARROWS}:arrows-complete`]: UPDATES_PHASE.ENTER_SURFACE,
  [`${UPDATES_PHASE.ENTER_LABELS}:labels-complete`]: UPDATES_PHASE.ENTER_SURFACE,
  [`${UPDATES_PHASE.ENTER_SURFACE}:surface-complete`]: UPDATES_PHASE.UPDATES,
  [`${UPDATES_PHASE.UPDATES}:return-requested`]: UPDATES_PHASE.RETURN_SURFACE,
  [`${UPDATES_PHASE.RETURN_SURFACE}:surface-complete`]: UPDATES_PHASE.RETURN_LABELS,
  [`${UPDATES_PHASE.RETURN_LABELS}:labels-complete`]: UPDATES_PHASE.RETURN_ARROWS,
  [`${UPDATES_PHASE.RETURN_ARROWS}:arrows-complete`]: UPDATES_PHASE.RETURN_ARROW_TURN,
  [`${UPDATES_PHASE.RETURN_ARROW_TURN}:turns-complete`]: UPDATES_PHASE.LANDING,
})

export function advanceUpdatesPhase(phase, event) {
  return TRANSITIONS[`${phase}:${event}`] ?? phase
}

export function isUpdatesFlowActive(phase) {
  return phase !== UPDATES_PHASE.LANDING
}

export function resolveTouchReturnSwipe({ armed, ready, pointerType, startY, endY }) {
  if (!armed || !ready || !['touch', 'pen'].includes(pointerType)) return false
  if (!Number.isFinite(startY) || !Number.isFinite(endY)) return false
  return endY - startY >= 42
}
