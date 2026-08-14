export const UPDATES_PHASE = Object.freeze({
  LANDING: 'landing',
  ENTER_SURFACE: 'enter-surface',
  UPDATES: 'updates',
  RETURN_SURFACE: 'return-surface',
})

const TRANSITIONS = Object.freeze({
  [`${UPDATES_PHASE.LANDING}:enter-requested`]: UPDATES_PHASE.ENTER_SURFACE,
  [`${UPDATES_PHASE.ENTER_SURFACE}:surface-complete`]: UPDATES_PHASE.UPDATES,
  [`${UPDATES_PHASE.UPDATES}:return-requested`]: UPDATES_PHASE.RETURN_SURFACE,
  [`${UPDATES_PHASE.RETURN_SURFACE}:surface-complete`]: UPDATES_PHASE.LANDING,
})

export function advanceUpdatesPhase(phase, event) {
  return TRANSITIONS[`${phase}:${event}`] ?? phase
}
