import { describe, expect, it } from 'vitest'
import { migrateLegacyOrderFixture } from './fixtures/legacyOrderClockAdapter'
import {
  WORLD_CLOCK_QUANTIZATION_BOUND_TICKS,
  WORLD_CLOCK_MODES,
  type WorldClockConfiguration,
  WORLD_CLOCK_TICKS_PER_GAME_MINUTE,
  WorldClockRuntime,
  createWorldClockConfiguration,
  worldClockView,
} from '../src/center/runtime/worldClock'

class ManualMonotonicClock {
  constructor(private timestamp = 0) {}
  nowMilliseconds() { return this.timestamp }
  advance(milliseconds: number) { this.timestamp += milliseconds }
}

const trialConfig = createWorldClockConfiguration()

describe('world clock runtime', () => {
  it('uses one world-scoped clock across callers without scene-specific resets', () => {
    const time = new ManualMonotonicClock()
    const runtime = new WorldClockRuntime(time, trialConfig)
    time.advance(1_000)
    const afterFirstScene = runtime.read()
    time.advance(1_000)
    const afterSecondScene = runtime.read()

    expect(afterFirstScene.worldTimeTicks).toBe(3_000_000)
    expect(afterSecondScene.worldTimeTicks).toBe(6_000_000)
    expect(runtime.snapshot().worldTimeTicks).toBe(afterSecondScene.worldTimeTicks)
  })

  it('switches mode after settling elapsed time at the old rate', () => {
    const time = new ManualMonotonicClock()
    const runtime = new WorldClockRuntime(time, trialConfig)
    time.advance(1_000)
    runtime.setMode('phone')
    time.advance(2_000)
    expect(runtime.read().worldTimeTicks).toBe(3_600_000)
  })

  it('preserves fractional ticks across many 0.009x samples within one tick', () => {
    const time = new ManualMonotonicClock()
    const config = createWorldClockConfiguration({ normal: 0.009 })
    const runtime = new WorldClockRuntime(time, config)
    for (let index = 0; index < 100_000; index += 1) {
      time.advance(0.1)
      runtime.read()
    }

    const expectedTicks = 100_000 * 0.1 * 0.009 * 1_000
    const actualTicks = runtime.snapshot().worldTimeTicks
    expect(Math.abs(actualTicks - expectedTicks)).toBeLessThanOrEqual(WORLD_CLOCK_QUANTIZATION_BOUND_TICKS)
    expect(runtime.snapshot().fractionalTickRemainder).toBeGreaterThanOrEqual(0)
    expect(runtime.snapshot().fractionalTickRemainder).toBeLessThan(1)
  })

  it('keeps fractional remainder across repeated samples versus one large sample', () => {
    const sampledTime = new ManualMonotonicClock()
    const referenceTime = new ManualMonotonicClock()
    const sampled = new WorldClockRuntime(sampledTime, createWorldClockConfiguration({ normal: 0.009 }))
    const reference = new WorldClockRuntime(referenceTime, createWorldClockConfiguration({ normal: 0.009 }))

    for (let index = 0; index < 10_000; index += 1) {
      sampledTime.advance(0.1)
      sampled.read()
    }
    referenceTime.advance(1_000)
    expect(Math.abs(sampled.read().worldTimeTicks - reference.read().worldTimeTicks))
      .toBeLessThanOrEqual(WORLD_CLOCK_QUANTIZATION_BOUND_TICKS)
  })

  it('retains fractional remainder when a runtime is reconstructed', () => {
    const time = new ManualMonotonicClock()
    const config = createWorldClockConfiguration({ normal: 0.009 })
    const runtime = new WorldClockRuntime(time, config)
    time.advance(0.1)
    const saved = runtime.read()
    const reopened = new WorldClockRuntime(time, config, saved)

    expect(saved.worldTimeTicks).toBe(0)
    expect(saved.fractionalTickRemainder).toBeCloseTo(0.9)
    time.advance(0.1)
    expect(reopened.read().worldTimeTicks).toBe(1)
  })

  it('carries fractional ticks across rapid mode changes', () => {
    const time = new ManualMonotonicClock()
    const runtime = new WorldClockRuntime(
      time,
      createWorldClockConfiguration({ normal: 0.009, phone: 0.3 }),
    )
    for (let index = 0; index < 10_000; index += 1) {
      time.advance(0.1)
      runtime.setMode(index % 2 === 0 ? 'phone' : 'normal')
    }

    const expectedTicks = 5_000 * 0.1 * (0.009 + 0.3) * 1_000
    expect(Math.abs(runtime.snapshot().worldTimeTicks - expectedTicks))
      .toBeLessThanOrEqual(WORLD_CLOCK_QUANTIZATION_BOUND_TICKS)
  })

  it('freezes on suspend and ignores closed-session time after resume or process reconstruction', () => {
    const time = new ManualMonotonicClock()
    const runtime = new WorldClockRuntime(time, trialConfig)
    time.advance(1_000)
    const suspended = runtime.suspend()

    time.advance(86_400_000)
    expect(runtime.read().worldTimeTicks).toBe(suspended.worldTimeTicks)
    runtime.resume('normal')
    expect(runtime.read().worldTimeTicks).toBe(suspended.worldTimeTicks)

    time.advance(1_000)
    expect(runtime.read().worldTimeTicks).toBe(suspended.worldTimeTicks + 3_000_000)

    const saved = runtime.snapshot()
    time.advance(86_400_000)
    const reopened = new WorldClockRuntime(time, trialConfig, saved)
    expect(reopened.read().worldTimeTicks).toBe(saved.worldTimeTicks)
  })

  it('rejects same-session monotonic rollback when resuming from suspend', () => {
    const time = new ManualMonotonicClock(100)
    const runtime = new WorldClockRuntime(time, trialConfig)
    time.advance(10)
    const suspended = runtime.suspend()
    time.advance(-20)

    expect(() => runtime.resume()).toThrow('must not move backwards')
    expect(runtime.snapshot()).toEqual(suspended)

    time.advance(20)
    expect(runtime.resume().suspended).toBe(false)
    expect(runtime.snapshot().worldTimeTicks).toBe(suspended.worldTimeTicks)
  })

  it('validates every constructor rate and snapshots mutable configuration input', () => {
    for (const mode of WORLD_CLOCK_MODES) {
      for (const invalidRate of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const rates = { ...trialConfig.rates, [mode]: invalidRate }
        const directConfiguration = { rates } as WorldClockConfiguration
        expect(() => new WorldClockRuntime(new ManualMonotonicClock(), directConfiguration))
          .toThrow('finite, non-negative')
      }
    }

    const time = new ManualMonotonicClock()
    const mutableRates = { ...trialConfig.rates }
    const directConfiguration: WorldClockConfiguration = { rates: mutableRates }
    const runtime = new WorldClockRuntime(time, directConfiguration)
    mutableRates.normal = -5
    time.advance(1_000)
    expect(runtime.read().worldTimeTicks).toBe(3_000_000)

    const created = createWorldClockConfiguration()
    expect(Object.isFrozen(created)).toBe(true)
    expect(Object.isFrozen(created.rates)).toBe(true)
  })

  it('leaves both clock state and sampling anchor unchanged when overflow rejects an advance', () => {
    const time = new ManualMonotonicClock()
    const runtime = new WorldClockRuntime(time, trialConfig, {
      worldTimeTicks: Number.MAX_SAFE_INTEGER - 1_000,
      fractionalTickRemainder: 0,
    })
    const before = runtime.snapshot()

    expect(() => runtime.advanceTo(1)).toThrow('safe integer range')
    expect(runtime.snapshot()).toEqual(before)
    // Repeating the same failed sample must fail again; the first error must not consume it.
    expect(() => runtime.advanceTo(1)).toThrow('safe integer range')
    expect(runtime.snapshot()).toEqual(before)
  })

  it('rejects backwards monotonic timestamps and invalid trial rates', () => {
    const time = new ManualMonotonicClock(10)
    const runtime = new WorldClockRuntime(time, trialConfig)
    expect(() => runtime.advanceTo(9)).toThrow('must not move backwards')
    expect(() => createWorldClockConfiguration({ normal: Number.NaN })).toThrow('finite, non-negative')
    expect(() => createWorldClockConfiguration({ normal: -1 })).toThrow('finite, non-negative')
  })

  it('derives a relative calendar view from world ticks', () => {
    const view = worldClockView({
      worldTimeTicks: WORLD_CLOCK_TICKS_PER_GAME_MINUTE * 1_450 + 1_500_000,
      fractionalTickRemainder: 0,
      mode: 'normal',
      suspended: false,
    })
    expect(view.dayIndex).toBe(1)
    expect(view.minuteOfDay).toBe(10)
    expect(view.secondOfMinute).toBe(1.5)
    expect(view.absoluteGameMinutes).toBe(1_450.025)
  })

  it('bridges a legacy epoch fixture with explicit fallback and an idempotent marker', () => {
    const nowEpoch = 1_800_000_000_000
    const original = { number: 37, createdAt: nowEpoch - 20_000, readyAt: nowEpoch - 5_000 }
    const migrated = migrateLegacyOrderFixture(original, 9_000_000, 15_000_000)

    expect(migrated.status).toBe('migrated')
    if (migrated.status !== 'migrated') throw new Error('expected fixture to migrate')
    expect(migrated.order.readyAtGameTicks).toBe(24_000_000)
    expect(migrated.order.readyAt).toBe(original.readyAt)

    const repeated = migrateLegacyOrderFixture(migrated.order, 100_000_000, 15_000_000)
    expect(repeated).toEqual({ status: 'already-migrated', order: migrated.order })
  })

  it('keeps malformed fixture data intact when order identity cannot be trusted', () => {
    const original = { number: 0, createdAt: 'bad', readyAt: -1 }
    const result = migrateLegacyOrderFixture(original, 5_000, 20_000)
    expect(result).toEqual({ status: 'blocked', original, reason: 'invalid-order-number' })
  })

  it('does not turn wall-clock epoch distance into world time in the fixture bridge', () => {
    const currentWorldTicks = 6_000_000
    const explicitFallbackTicks = 12_000_000
    const earlyEpoch = migrateLegacyOrderFixture(
      { number: 1, createdAt: 1, readyAt: 2 }, currentWorldTicks, explicitFallbackTicks,
    )
    const lateEpoch = migrateLegacyOrderFixture(
      { number: 1, createdAt: 1_800_000_000_000, readyAt: 1_800_000_030_000 },
      currentWorldTicks,
      explicitFallbackTicks,
    )
    expect(earlyEpoch.status).toBe('migrated')
    expect(lateEpoch.status).toBe('migrated')
    if (earlyEpoch.status !== 'migrated' || lateEpoch.status !== 'migrated') throw new Error('expected fixtures to migrate')
    expect(earlyEpoch.order.readyAtGameTicks).toBe(lateEpoch.order.readyAtGameTicks)
  })
})
