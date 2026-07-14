import { describe, expect, it } from 'vitest'
import { progressV1Fixtures } from './fixtures/progressV1'

describe('progress v1 migration fixtures', () => {
  it('provides the four required baseline states', () => {
    expect(Object.keys(progressV1Fixtures)).toEqual([
      'neverStarted',
      'midwayM2',
      'enteredM4NotCompleted',
      'centerPermanentlyUnlocked',
    ])
  })

  it.each(Object.entries(progressV1Fixtures))('%s is a readable v1 payload', (_name, fixture) => {
    expect(fixture._version).toBe(1)
    expect(typeof fixture.lastScrollY).toBe('number')
    expect(typeof fixture.centerUnlocked).toBe('boolean')
  })

  it('keeps reaching M4 distinct from permanent Center unlock', () => {
    expect(progressV1Fixtures.enteredM4NotCompleted.maxReadPhase).toBe('M4')
    expect(progressV1Fixtures.enteredM4NotCompleted.centerUnlocked).toBe(false)
    expect(progressV1Fixtures.centerPermanentlyUnlocked.centerUnlocked).toBe(true)
  })
})
