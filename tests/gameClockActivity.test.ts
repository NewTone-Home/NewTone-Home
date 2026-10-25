import { describe, expect, it } from 'vitest'
import {
  gameClockActivityMode,
  gameClockMultiplierForActivity,
  type GameClockRateInputs,
} from '../src/center/runtime/gameClockActivity'

// Synthetic test-only inputs; these are not proposed product multipliers.
const TEST_ONLY_RATES: GameClockRateInputs = {
  normalPlay: 30,
  ordinaryReading: 0.4,
  paidDialogue: 0.1,
  freeIdle: 30,
  paidIdle: 0.01,
}

describe('semantic game clock activity mapping', () => {
  it.each(['npc-dialogue', 'scene-dialogue', 'inner-monologue'] as const)(
    'classifies %s as dialogue without examining text',
    (source) => expect(gameClockActivityMode(source)).toBe('dialogue'),
  )

  it.each([
    'counter-observation',
    'menu-reading',
    'plant-observation',
    'phone-reading',
  ] as const)('classifies %s as shared ordinary reading', (source) => {
    expect(gameClockActivityMode(source)).toBe('ordinary-reading')
    expect(gameClockMultiplierForActivity('free', source, TEST_ONLY_RATES)).toBe(TEST_ONLY_RATES.ordinaryReading)
    expect(gameClockMultiplierForActivity('paid', source, TEST_ONLY_RATES)).toBe(TEST_ONLY_RATES.ordinaryReading)
  })

  it('keeps free dialogue and closed time at zero, including inner monologue', () => {
    expect(gameClockMultiplierForActivity('free', 'npc-dialogue', TEST_ONLY_RATES)).toBe(0)
    expect(gameClockMultiplierForActivity('free', 'inner-monologue', TEST_ONLY_RATES)).toBe(0)
    expect(gameClockMultiplierForActivity('free', 'closed', TEST_ONLY_RATES)).toBe(0)
    expect(gameClockMultiplierForActivity('paid', 'closed', TEST_ONLY_RATES)).toBe(0)
  })

  it('uses injected rates for trial play, paid dialogue, and edition-specific idle', () => {
    expect(gameClockMultiplierForActivity('free', 'normal-play', TEST_ONLY_RATES)).toBe(30)
    expect(gameClockMultiplierForActivity('paid', 'scene-dialogue', TEST_ONLY_RATES)).toBe(0.1)
    expect(gameClockMultiplierForActivity('free', 'idle', TEST_ONLY_RATES)).toBe(30)
    expect(gameClockMultiplierForActivity('paid', 'idle', TEST_ONLY_RATES)).toBe(0.01)
    expect(TEST_ONLY_RATES.paidDialogue).toBeLessThan(TEST_ONLY_RATES.ordinaryReading)
    expect(TEST_ONLY_RATES.paidIdle).toBeLessThan(TEST_ONLY_RATES.paidDialogue)
  })

  it('rejects unconfigured rates instead of supplying formal defaults', () => {
    expect(() => gameClockMultiplierForActivity('free', 'phone-reading', {
      ...TEST_ONLY_RATES,
      ordinaryReading: Number.NaN,
    })).toThrow(RangeError)
    expect(() => gameClockMultiplierForActivity('paid', 'idle', {
      ...TEST_ONLY_RATES,
      paidIdle: Number.POSITIVE_INFINITY,
    })).toThrow(RangeError)
    expect(() => gameClockMultiplierForActivity('paid', 'scene-dialogue', {
      ...TEST_ONLY_RATES,
      paidDialogue: -1,
    })).toThrow(RangeError)
  })
})
