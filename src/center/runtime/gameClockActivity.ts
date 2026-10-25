/** Semantic activity sources. Callers classify state transitions, never prose text. */
export type GameClockActivitySource =
  | 'normal-play'
  | 'npc-dialogue'
  | 'scene-dialogue'
  | 'inner-monologue'
  | 'counter-observation'
  | 'menu-reading'
  | 'plant-observation'
  | 'phone-reading'
  | 'idle'
  | 'closed'

export type GameClockActivityMode =
  | 'normal-play'
  | 'dialogue'
  | 'ordinary-reading'
  | 'idle'
  | 'closed'

export type GameClockEdition = 'free' | 'paid'

/**
 * All rates except free formal dialogue and closed=0 remain caller supplied.
 * The first integration harness should provide these values from test fixtures;
 * this module intentionally defines no product defaults.
 */
export type GameClockRateInputs = {
  normalPlay: number
  ordinaryReading: number
  paidDialogue: number
  freeIdle: number
  paidIdle: number
}

const activityModeBySource: Record<GameClockActivitySource, GameClockActivityMode> = {
  'normal-play': 'normal-play',
  'npc-dialogue': 'dialogue',
  'scene-dialogue': 'dialogue',
  'inner-monologue': 'dialogue',
  'counter-observation': 'ordinary-reading',
  'menu-reading': 'ordinary-reading',
  'plant-observation': 'ordinary-reading',
  'phone-reading': 'ordinary-reading',
  idle: 'idle',
  closed: 'closed',
}

export function gameClockActivityMode(source: GameClockActivitySource): GameClockActivityMode {
  return activityModeBySource[source]
}

export function gameClockMultiplierForActivity(
  edition: GameClockEdition,
  source: GameClockActivitySource,
  rates: GameClockRateInputs,
): number {
  const mode = gameClockActivityMode(source)
  if (mode === 'closed') return 0
  if (mode === 'dialogue' && edition === 'free') return 0

  const rate = mode === 'normal-play'
    ? rates.normalPlay
    : mode === 'ordinary-reading'
      ? rates.ordinaryReading
      : mode === 'dialogue'
        ? rates.paidDialogue
        : edition === 'free'
          ? rates.freeIdle
          : rates.paidIdle

  if (!Number.isFinite(rate) || rate < 0) {
    throw new RangeError(`A finite, non-negative ${mode} rate must be injected`)
  }
  return rate
}
