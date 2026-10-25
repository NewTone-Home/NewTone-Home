import { describe, expect, it } from 'vitest'
import { createSessionGameClock } from '../src/center/runtime/sessionGameClock'
import type { GameClockRateInputs } from '../src/center/runtime/gameClockActivity'

// Synthetic harness inputs. They are deliberately not the pending proposed trial values.
const FIXTURE_RATES: GameClockRateInputs = {
  normalPlay: 8,
  ordinaryReading: 4,
  paidDialogue: 2,
  freeIdle: 6,
  paidIdle: 1,
}
const FIXTURE_IDLE_AFTER_MS = 1_000

function createFixture(now: () => number, edition: 'free' | 'paid' = 'free', initialGameTimeMs = 0) {
  return createSessionGameClock({
    edition,
    rates: FIXTURE_RATES,
    idleAfterMs: FIXTURE_IDLE_AFTER_MS,
    now,
    initialGameTimeMs,
  })
}

describe('session game clock', () => {
  it('uses explicit activity sources and keeps dialogue, monologue, and reading distinct', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)

    realTimeMs = 1_000
    session.setActivity('inner-monologue')
    realTimeMs = 4_000
    expect(session.read()).toMatchObject({ gameTimeMs: 8_000, activity: 'inner-monologue', multiplier: 0 })

    session.setActivity('phone-reading')
    realTimeMs = 5_000
    expect(session.read()).toMatchObject({ gameTimeMs: 12_000, activity: 'phone-reading', multiplier: 4 })
  })

  it('shares ordinary-reading input across editions without setting its product value', () => {
    let freeRealTimeMs = 0
    let paidRealTimeMs = 0
    const free = createFixture(() => freeRealTimeMs, 'free')
    const paid = createFixture(() => paidRealTimeMs, 'paid')

    expect(free.setActivity('counter-observation').multiplier).toBe(FIXTURE_RATES.ordinaryReading)
    expect(paid.setActivity('menu-reading').multiplier).toBe(FIXTURE_RATES.ordinaryReading)
  })

  it('enters idle at the injected threshold and partitions time at the threshold instant', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)

    realTimeMs = 1_500
    expect(session.read()).toMatchObject({
      gameTimeMs: 8_000 + 500 * FIXTURE_RATES.freeIdle,
      activity: 'idle',
      multiplier: FIXTURE_RATES.freeIdle,
    })
  })

  it('restores normal-play timing on input and counts the preceding idle segment once', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)

    realTimeMs = 2_000
    expect(session.markInput()).toMatchObject({
      gameTimeMs: FIXTURE_IDLE_AFTER_MS * FIXTURE_RATES.normalPlay
        + FIXTURE_IDLE_AFTER_MS * FIXTURE_RATES.freeIdle,
      activity: 'normal-play',
      multiplier: FIXTURE_RATES.normalPlay,
    })
    realTimeMs = 2_500
    expect(session.read().gameTimeMs).toBe(18_000)
  })

  it('does not treat ongoing reading as idle despite elapsed wall time or input', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivity('plant-observation')

    realTimeMs = 5_000
    session.markInput()
    expect(session.read()).toMatchObject({
      activity: 'plant-observation',
      activityMode: 'ordinary-reading',
      multiplier: FIXTURE_RATES.ordinaryReading,
      gameTimeMs: 5_000 * FIXTURE_RATES.ordinaryReading,
    })
  })

  it('keeps one session clock continuous across scene-specific activity changes', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)

    realTimeMs = 500
    session.setActivity('scene-dialogue')
    realTimeMs = 1_000
    expect(session.read().gameTimeMs).toBe(4_000)
    session.setActivity('npc-dialogue')
    realTimeMs = 2_000
    expect(session.read()).toMatchObject({ gameTimeMs: 4_000, activity: 'npc-dialogue' })
  })

  it('freezes on close and resumes injected memory state from a fresh real-time anchor', () => {
    let realTimeMs = 0
    const beforeClose = createFixture(() => realTimeMs)
    realTimeMs = 1_000
    const closed = beforeClose.close()
    expect(closed).toMatchObject({ gameTimeMs: 8_000, activity: 'closed', multiplier: 0, frozen: true })

    realTimeMs = 100_000_000
    const reopened = createFixture(() => realTimeMs, 'free', closed.gameTimeMs)
    expect(reopened.read().gameTimeMs).toBe(closed.gameTimeMs)
    realTimeMs += 500
    expect(reopened.read().gameTimeMs).toBe(closed.gameTimeMs + 500 * FIXTURE_RATES.normalPlay)
  })

  it('requires callers to inject the idle threshold', () => {
    expect(() => createSessionGameClock({
      edition: 'free',
      rates: FIXTURE_RATES,
      idleAfterMs: Number.NaN,
      now: () => 0,
    })).toThrow(RangeError)
  })
})
