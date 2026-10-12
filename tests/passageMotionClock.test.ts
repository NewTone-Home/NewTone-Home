import { describe, expect, it } from 'vitest'
import { passageMotionDeadline } from '../src/center/runtime/passageMotionClock'
import { sceneDoorMotion } from '../src/center/runtime/sceneDoorConfig'
describe('authoritative passage motion clock', () => {
  it('has opening and closing deadlines independent of rendered characters', () => {
    expect(passageMotionDeadline('opening', 100)).toBe(100 + sceneDoorMotion.openingMs)
    expect(passageMotionDeadline('closing', 500)).toBe(500 + sceneDoorMotion.closingMs)
    expect(passageMotionDeadline('open', 100)).toBeNull()
  })
})
