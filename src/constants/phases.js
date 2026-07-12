export const PHASES = ['M1', 'M2', 'M3', 'M4']

export const getPhaseRank = (phase) =>
  PHASES.includes(phase) ? PHASES.indexOf(phase) : -1

export const isValidPhase = (phase) =>
  getPhaseRank(phase) !== -1

export const isAfter = (a, b) =>
  getPhaseRank(a) > getPhaseRank(b)

export const isSameOrAfter = (a, b) =>
  getPhaseRank(a) >= getPhaseRank(b)
