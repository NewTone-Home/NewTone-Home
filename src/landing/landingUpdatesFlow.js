export const UPDATES_PHASE = Object.freeze({
  LANDING: 'landing',
  ENTER_ARROWS: 'enter-arrows',
  ENTER_LABELS: 'enter-labels',
  ENTER_SURFACE: 'enter-surface',
  UPDATES: 'updates',
  RETURN_SURFACE: 'return-surface',
  RETURN_LABELS: 'return-labels',
  RETURN_ARROWS: 'return-arrows',
})

const TRANSITIONS = Object.freeze({
  [`${UPDATES_PHASE.LANDING}:enter-requested`]: UPDATES_PHASE.ENTER_ARROWS,
  [`${UPDATES_PHASE.ENTER_ARROWS}:arrows-complete`]: UPDATES_PHASE.ENTER_LABELS,
  [`${UPDATES_PHASE.ENTER_LABELS}:labels-complete`]: UPDATES_PHASE.ENTER_SURFACE,
  [`${UPDATES_PHASE.ENTER_SURFACE}:surface-complete`]: UPDATES_PHASE.UPDATES,
  [`${UPDATES_PHASE.UPDATES}:return-requested`]: UPDATES_PHASE.RETURN_SURFACE,
  [`${UPDATES_PHASE.RETURN_SURFACE}:surface-complete`]: UPDATES_PHASE.RETURN_LABELS,
  [`${UPDATES_PHASE.RETURN_LABELS}:labels-complete`]: UPDATES_PHASE.RETURN_ARROWS,
  [`${UPDATES_PHASE.RETURN_ARROWS}:arrows-complete`]: UPDATES_PHASE.LANDING,
})

export function advanceUpdatesPhase(phase, event) {
  return TRANSITIONS[`${phase}:${event}`] ?? phase
}

export function isUpdatesFlowActive(phase) {
  return phase !== UPDATES_PHASE.LANDING
}

export function resolveTouchReturnAction({ armed, ready }) {
  if (!armed) return 'arm'
  return ready ? 'return' : 'wait'
}
