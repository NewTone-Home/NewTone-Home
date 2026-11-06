import { describe, expect, it } from 'vitest'
import { createGameClock } from '../src/center/runtime/gameClock'

describe('game clock', () => {
  it('advances at the normal 30x trial baseline', () => {
    let realTimeMs = 100
    const clock = createGameClock({ now: () => realTimeMs })

    realTimeMs += 2_000

    expect(clock.read().gameTimeMs).toBe(60_000)
  })

  it('keeps a free formal dialogue frozen and resumes at the explicit next rate', () => {
    let realTimeMs = 0
    const clock = createGameClock({ now: () => realTimeMs, multiplier: 0 })

    realTimeMs += 8_000
    expect(clock.read().gameTimeMs).toBe(0)

    clock.setMultiplier(30)
    realTimeMs += 1_000
    expect(clock.read().gameTimeMs).toBe(30_000)
  })

  it('settles each old-rate segment when rates change without an intervening read', () => {
    let realTimeMs = 0
    const clock = createGameClock({ now: () => realTimeMs })

    realTimeMs += 1_000
    clock.setMultiplier(0)
    realTimeMs += 5_000
    clock.setMultiplier(30)
    realTimeMs += 1_000

    expect(clock.read().gameTimeMs).toBe(60_000)
  })

  it('supports independent explicit freeze reasons and does not count frozen time', () => {
    let realTimeMs = 0
    const clock = createGameClock({ now: () => realTimeMs })

    realTimeMs += 1_000
    clock.setFrozen('demo-pause', true)
    realTimeMs += 60_000
    clock.setFrozen('demo-page-hidden', true)
    clock.setFrozen('demo-pause', false)
    realTimeMs += 10_000
    expect(clock.read()).toMatchObject({ gameTimeMs: 30_000, frozen: true })

    clock.setFrozen('demo-page-hidden', false)
    realTimeMs += 500
    expect(clock.read()).toMatchObject({ gameTimeMs: 45_000, frozen: false })
  })

  it('accumulates across sequential reads of the same clock instance', () => {
    let realTimeMs = 0
    const clock = createGameClock({ now: () => realTimeMs })

    realTimeMs += 1_000
    const streetSceneTime = clock.read().gameTimeMs
    realTimeMs += 1_000
    const cafeSceneTime = clock.read().gameTimeMs

    expect(streetSceneTime).toBe(30_000)
    expect(cafeSceneTime).toBe(60_000)
  })

  it('continues restored simulation time from a new real-time anchor without offline catch-up', () => {
    let realTimeMs = 100_000_000
    const clock = createGameClock({
      now: () => realTimeMs,
      initialGameTimeMs: 42_000,
    })

    expect(clock.read().gameTimeMs).toBe(42_000)
    realTimeMs += 1_000
    expect(clock.read().gameTimeMs).toBe(72_000)
  })

  it('returns a clock snapshot without story-calendar fields', () => {
    let realTimeMs = 0
    const clock = createGameClock({ now: () => realTimeMs })
    realTimeMs += 24 * 60 * 60 * 1_000

    const snapshot = clock.read()
    expect(snapshot.gameTimeMs).toBe(24 * 60 * 60 * 1_000 * 30)
    expect(snapshot).not.toHaveProperty('day')
    expect(snapshot).not.toHaveProperty('month')
  })

  it('keeps internal freeze reasons safe from snapshot array mutation', () => {
    const clock = createGameClock({ now: () => 0 })
    clock.setFrozen('demo-pause', true)
    const snapshot = clock.read()

    ;(snapshot.freezeReasons as string[]).push('external-mutation')

    expect(clock.read().freezeReasons).toEqual(['demo-pause'])
    expect(clock.read().frozen).toBe(true)
  })

  it('does not repeat elapsed time after the supplied monotonic time moves backwards', () => {
    let realTimeMs = 100
    const clock = createGameClock({ now: () => realTimeMs })
    realTimeMs = 200
    expect(clock.read().gameTimeMs).toBe(3_000)

    realTimeMs = 150
    expect(clock.read().gameTimeMs).toBe(3_000)
    realTimeMs = 250
    expect(clock.read().gameTimeMs).toBe(4_500)
  })

  it('validates explicit monotonic samples and keeps their high-water mark after invalid or backward samples', () => {
    let realTimeMs = 0
    const clock = createGameClock({ now: () => realTimeMs })

    expect(clock.read(100).gameTimeMs).toBe(3_000)
    expect(clock.read(90).gameTimeMs).toBe(3_000)
    expect(() => clock.read(Number.NaN)).toThrow(RangeError)
    expect(() => clock.setMultiplier(2, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(clock.read(110).gameTimeMs).toBe(3_300)
  })

  it('rejects non-finite multiplier, initial simulation time, and initial real-time anchor', () => {
    for (const multiplier of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createGameClock({ multiplier, now: () => 0 })).toThrow(RangeError)
    }
    for (const initialGameTimeMs of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createGameClock({ initialGameTimeMs, now: () => 0 })).toThrow(RangeError)
    }
    for (const initialRealTimeMs of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createGameClock({ now: () => initialRealTimeMs })).toThrow(RangeError)
    }
  })

  it('rejects non-finite later time without corrupting its previous anchor or accumulator', () => {
    let realTimeMs = 0
    const clock = createGameClock({ now: () => realTimeMs })

    realTimeMs = Number.POSITIVE_INFINITY
    expect(() => clock.read()).toThrow(RangeError)
    realTimeMs = 1_000
    expect(clock.read().gameTimeMs).toBe(30_000)
  })

  it('rejects accumulation overflow without committing a partial update', () => {
    let realTimeMs = 0
    const clock = createGameClock({ now: () => realTimeMs, multiplier: Number.MAX_VALUE })
    realTimeMs = 2

    expect(() => clock.read()).toThrow(RangeError)
    realTimeMs = 1
    expect(clock.read().gameTimeMs).toBe(Number.MAX_VALUE)
  })

  it('rejects invalid rates and anonymous freeze reasons', () => {
    const clock = createGameClock({ now: () => 0 })

    expect(() => clock.setMultiplier(-1)).toThrow(RangeError)
    expect(() => clock.setFrozen(' ', true)).toThrow(TypeError)
  })
})
