import { describe, expect, it } from 'vitest'
import {
  gameClockActivityMode,
  gameClockMultiplierForActivity,
  type GameClockRateInputs,
} from '../src/center/runtime/gameClockActivity'

// Approved free-version trial inputs. These tests are isolated from user saves.
const TEST_ONLY_RATES: GameClockRateInputs = {
  normalPlay: 30,
  ordinaryReading: 15,
  idle: 5,
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
    'scene-observation',
  ] as const)('classifies %s as shared ordinary reading', (source) => {
    expect(gameClockActivityMode(source)).toBe('ordinary-reading')
    expect(gameClockMultiplierForActivity(source, TEST_ONLY_RATES)).toBe(TEST_ONLY_RATES.ordinaryReading)
  })

  it('keeps dialogue and inner monologue at zero while idle is a separate 5x mode', () => {
    expect(gameClockMultiplierForActivity('npc-dialogue', TEST_ONLY_RATES)).toBe(0)
    expect(gameClockMultiplierForActivity('inner-monologue', TEST_ONLY_RATES)).toBe(0)
    expect(gameClockMultiplierForActivity('idle', TEST_ONLY_RATES)).toBe(5)
    expect(gameClockActivityMode('closed')).toBe('closed')
  })

  it('maps the free trial rates and rejects non-finite or negative inputs', () => {
    expect(gameClockMultiplierForActivity('normal-play', TEST_ONLY_RATES)).toBe(30)
    expect(gameClockMultiplierForActivity('menu-reading', TEST_ONLY_RATES)).toBe(15)
    expect(() => gameClockMultiplierForActivity('phone-reading', {
      ...TEST_ONLY_RATES,
      ordinaryReading: Number.NaN,
    })).toThrow(RangeError)
    expect(() => gameClockMultiplierForActivity('idle', {
      ...TEST_ONLY_RATES,
      idle: -1,
    })).toThrow(RangeError)
  })

})
