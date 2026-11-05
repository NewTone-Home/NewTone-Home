import { describe, expect, it } from 'vitest'
import { createSessionGameClock } from '../src/center/runtime/sessionGameClock'
import type { GameClockRateInputs } from '../src/center/runtime/gameClockActivity'

// Isolated in-memory fixture; it uses no player storage.
const FIXTURE_RATES: GameClockRateInputs = {
  normalPlay: 30,
  ordinaryReading: 15,
  idle: 5,
}
const FIXTURE_IDLE_AFTER_MS = 60_000

function createFixture(now: () => number, initialGameTimeMs = 0) {
  return createSessionGameClock({
    rates: FIXTURE_RATES,
    idleAfterMs: FIXTURE_IDLE_AFTER_MS,
    now,
    initialGameTimeMs,
  })
}

describe('session game clock', () => {
  it('ordinary reading runs at 15x before 60 seconds and 5x afterward, even if first read is at 90 seconds', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('page-a:observation', 'counter-observation')

    realTimeMs = 90_000
    expect(session.read()).toMatchObject({
      gameTimeMs: 60_000 * 15 + 30_000 * 5,
      activity: 'counter-observation',
      activityMode: 'idle',
      multiplier: 5,
      idle: true,
    })
  })

  it('formal dialogue and inner monologue are 0x for 60 seconds then 5x, even if first read is at 90 seconds', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('page-a:dialogue', 'inner-monologue')

    realTimeMs = 90_000
    expect(session.read()).toMatchObject({
      gameTimeMs: 30_000 * 5,
      activity: 'inner-monologue',
      activityMode: 'idle',
      multiplier: 5,
      idle: true,
    })
  })

  it.each([
    ['ordinary-reading', 'phone-reading', 60_000 * 15 + 30_000 * 5, 15],
    ['dialogue', 'inner-monologue', 30_000 * 5, 0],
  ] as const)('first input at 90 seconds settles %s, then restores its semantic rate', (_label, source, expectedBeforeInput, restoredRate) => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('active-page', source)
    realTimeMs = 90_000

    expect(session.markInput()).toMatchObject({
      gameTimeMs: expectedBeforeInput,
      activity: source,
      activityMode: restoredRate === 0 ? 'dialogue' : 'ordinary-reading',
      multiplier: restoredRate,
      idle: false,
    })
  })

  it('input after dialogue-idle restores 0x for the current dialogue, not 30x', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('page-a:dialogue', 'scene-dialogue')

    realTimeMs = 90_000
    session.read()
    expect(session.markInput()).toMatchObject({
      gameTimeMs: 150_000,
      activity: 'scene-dialogue',
      activityMode: 'dialogue',
      multiplier: 0,
      idle: false,
    })
    realTimeMs = 100_000
    expect(session.read().gameTimeMs).toBe(150_000)
  })

  it('input after reading-idle restores 15x for the current phone reading state', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('phone:reading', 'phone-reading')

    realTimeMs = 90_000
    session.read()
    session.markInput()
    realTimeMs = 100_000
    expect(session.read()).toMatchObject({
      gameTimeMs: 60_000 * 15 + 30_000 * 5 + 10_000 * 15,
      activity: 'phone-reading',
      activityMode: 'ordinary-reading',
      multiplier: 15,
      idle: false,
    })
  })

  it('user input before the threshold restarts the 60-second deadline', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('page-a:observation', 'plant-observation')

    realTimeMs = 50_000
    session.markInput()
    realTimeMs = 100_000
    expect(session.read()).toMatchObject({ idle: false, multiplier: 15 })
    realTimeMs = 110_000
    expect(session.read()).toMatchObject({ idle: true, multiplier: 5 })
  })

  it('automatic activity changes do not reset the last-input deadline', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('page-a:observation', 'counter-observation')

    realTimeMs = 30_000
    session.setActivitySource('page-a:observation', null)
    session.setActivitySource('page-a:dialogue', 'inner-monologue')
    realTimeMs = 90_000
    expect(session.read()).toMatchObject({
      gameTimeMs: 30_000 * 15 + 30_000 * 5,
      activity: 'inner-monologue',
      activityMode: 'idle',
      idle: true,
    })
  })

  it('keeps the new page activity when an old page cleanup removes its own source', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('old-page:dialogue', 'scene-dialogue')
    session.setActivitySource('new-page:dialogue', 'inner-monologue')

    session.setActivitySource('old-page:dialogue', null)
    expect(session.read()).toMatchObject({ activity: 'inner-monologue', multiplier: 0 })
    realTimeMs = 90_000
    expect(session.read()).toMatchObject({ activity: 'inner-monologue', activityMode: 'idle', multiplier: 5 })
  })

  it('prioritizes an active dialogue source while ordinary reading is also present', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('page-a:observation', 'plant-observation')
    session.setActivitySource('page-a:dialogue', 'npc-dialogue')

    expect(session.read()).toMatchObject({ activity: 'npc-dialogue', multiplier: 0 })
    session.setActivitySource('page-a:dialogue', null)
    expect(session.read()).toMatchObject({ activity: 'plant-observation', multiplier: 15 })
  })

  it('keeps one clock continuous across scene-specific sources without resetting idle time', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('scene-1:dialogue', 'scene-dialogue')

    realTimeMs = 30_000
    session.setActivitySource('scene-1:dialogue', null)
    session.setActivitySource('scene-2:observation', 'scene-observation')
    realTimeMs = 90_000
    expect(session.read()).toMatchObject({
      gameTimeMs: 30_000 * 15 + 30_000 * 5,
      activity: 'scene-observation',
      activityMode: 'idle',
      multiplier: 5,
    })
  })

  it('freezes on close and resumes in-memory time from a fresh real-time anchor without offline catch-up', () => {
    let realTimeMs = 0
    const beforeClose = createFixture(() => realTimeMs)
    realTimeMs = 30_000
    beforeClose.setActivitySource('scene-a:observation', 'counter-observation')
    realTimeMs = 60_000
    const closed = beforeClose.close()
    expect(closed).toMatchObject({ gameTimeMs: 30_000 * 30 + 30_000 * 15, activityMode: 'closed', multiplier: 0, frozen: true })

    realTimeMs = 100_000_000
    const reopened = createFixture(() => realTimeMs, closed.gameTimeMs)
    expect(reopened.read().gameTimeMs).toBe(closed.gameTimeMs)
    realTimeMs += 500
    expect(reopened.read().gameTimeMs).toBe(closed.gameTimeMs + 500 * FIXTURE_RATES.normalPlay)
  })

  it('does not let semantic activity changes clear an active idle override', () => {
    let realTimeMs = 0
    const session = createFixture(() => realTimeMs)
    session.setActivitySource('page-a:dialogue', 'npc-dialogue')
    realTimeMs = 90_000
    session.read()
    session.setActivitySource('page-b:observation', 'menu-reading')
    expect(session.read()).toMatchObject({ activity: 'npc-dialogue', idle: true, multiplier: 5 })
    session.setActivitySource('page-a:dialogue', null)
    expect(session.read()).toMatchObject({ activity: 'menu-reading', idle: true, multiplier: 5 })
  })

  it('requires callers to inject the idle threshold', () => {
    expect(() => createSessionGameClock({
      rates: FIXTURE_RATES,
      idleAfterMs: Number.NaN,
      now: () => 0,
    })).toThrow(RangeError)
  })
})
