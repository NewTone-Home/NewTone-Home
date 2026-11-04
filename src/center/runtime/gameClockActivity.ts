/** Semantic activity sources. Callers classify state transitions, never prose text. */
export type GameClockActivitySource =
  | 'normal-play'
  | 'npc-dialogue'
  | 'scene-dialogue'
  | 'inner-monologue'
  | 'scene-observation'
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

/** Free-version rates are supplied by the trial runtime; no rate is implicit here. */
export type GameClockRateInputs = {
  normalPlay: number
  ordinaryReading: number
  idle: number
}

const activityModeBySource: Record<GameClockActivitySource, GameClockActivityMode> = {
  'normal-play': 'normal-play',
  'npc-dialogue': 'dialogue',
  'scene-dialogue': 'dialogue',
  'inner-monologue': 'dialogue',
  'scene-observation': 'ordinary-reading',
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
  source: Exclude<GameClockActivitySource, 'closed'>,
  rates: GameClockRateInputs,
): number {
  const mode = gameClockActivityMode(source)
  if (mode === 'dialogue') return 0
  if (mode === 'closed') return 0

  const rate = mode === 'normal-play'
    ? rates.normalPlay
    : mode === 'ordinary-reading'
      ? rates.ordinaryReading
      : rates.idle

  if (!Number.isFinite(rate) || rate < 0) {
    throw new RangeError(`A finite, non-negative ${mode} rate must be injected`)
  }
  return rate
}
