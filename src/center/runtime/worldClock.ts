export const WORLD_CLOCK_TICKS_PER_GAME_SECOND = 1_000_000
export const WORLD_CLOCK_TICKS_PER_GAME_MINUTE = 60 * WORLD_CLOCK_TICKS_PER_GAME_SECOND
export const WORLD_CLOCK_TICKS_PER_GAME_DAY = 24 * 60 * WORLD_CLOCK_TICKS_PER_GAME_MINUTE
export const WORLD_CLOCK_TICK_GAME_MICROSECONDS = 1
export const WORLD_CLOCK_QUANTIZATION_BOUND_TICKS = 1

export type WorldClockMode = 'normal' | 'phone' | 'dialogue' | 'background' | 'idle'
export const WORLD_CLOCK_MODES: readonly WorldClockMode[] = Object.freeze([
  'normal', 'phone', 'dialogue', 'background', 'idle',
])

export type WorldClockRates = Readonly<Record<WorldClockMode, number>>
export type WorldClockConfiguration = Readonly<{ rates: WorldClockRates }>

/** Trial-only candidate rates in game seconds per real second; these are not canon settings. */
export const WORLD_CLOCK_TRIAL_RATES: WorldClockRates = Object.freeze({
  normal: 3, phone: 0.3, dialogue: 0.3, background: 0.009, idle: 0.009,
})

function snapshotWorldClockConfiguration(configuration: WorldClockConfiguration): WorldClockConfiguration {
  if (!configuration || typeof configuration !== 'object'
    || !configuration.rates || typeof configuration.rates !== 'object') {
    throw new TypeError('World clock configuration must provide a rates object')
  }

  const sourceRates = configuration.rates as Record<WorldClockMode, unknown>
  const rates = {} as Record<WorldClockMode, number>
  for (const mode of WORLD_CLOCK_MODES) {
    const rate = sourceRates[mode]
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) {
      throw new RangeError('World clock rate for ' + mode + ' must be a finite, non-negative number')
    }
    rates[mode] = rate
  }
  return Object.freeze({ rates: Object.freeze(rates) })
}

export function createWorldClockConfiguration(
  rates: Partial<Record<WorldClockMode, number>> = {},
): WorldClockConfiguration {
  return snapshotWorldClockConfiguration({
    rates: { ...WORLD_CLOCK_TRIAL_RATES, ...rates },
  })
}

export interface MonotonicTimeSource {
  /** Monotonic milliseconds since an arbitrary process-local origin. Never a wall-clock epoch. */
  nowMilliseconds(): number
}

export type WorldClockSnapshot = Readonly<{
  /** Whole game-time microseconds; 60,000,000 ticks equal one game minute. */
  worldTimeTicks: number
  /** Fractional tick carried between samples; always in [0, 1). */
  fractionalTickRemainder: number
  mode: WorldClockMode
  suspended: boolean
}>

export type WorldClockInitialState = Partial<WorldClockSnapshot>
export type WorldClockView = Readonly<{
  absoluteGameMinutes: number
  dayIndex: number
  minuteOfDay: number
  secondOfMinute: number
  worldTimeTicks: number
}>

function isWorldClockMode(value: unknown): value is WorldClockMode {
  return typeof value === 'string' && WORLD_CLOCK_MODES.includes(value as WorldClockMode)
}

function validateInitialState(state: WorldClockInitialState | undefined) {
  const worldTimeTicks = state?.worldTimeTicks ?? 0
  const fractionalTickRemainder = state?.fractionalTickRemainder ?? 0
  const mode = state?.mode ?? 'normal'
  const suspended = state?.suspended ?? false

  if (!Number.isSafeInteger(worldTimeTicks) || worldTimeTicks < 0) {
    throw new RangeError('worldTimeTicks must be a non-negative safe integer')
  }
  if (!Number.isFinite(fractionalTickRemainder) || fractionalTickRemainder < 0 || fractionalTickRemainder >= 1) {
    throw new RangeError('fractionalTickRemainder must be in [0, 1)')
  }
  if (!isWorldClockMode(mode)) throw new TypeError('Unknown world clock mode')
  if (typeof suspended !== 'boolean') throw new TypeError('suspended must be a boolean')
  return { worldTimeTicks, fractionalTickRemainder, mode, suspended }
}

export class WorldClockRuntime {
  private state: WorldClockSnapshot
  private lastSampleMilliseconds: number
  private readonly configuration: WorldClockConfiguration

  constructor(
    private readonly timeSource: MonotonicTimeSource,
    configuration: WorldClockConfiguration,
    initialState?: WorldClockInitialState,
  ) {
    this.configuration = snapshotWorldClockConfiguration(configuration)
    this.state = validateInitialState(initialState)
    // Restored runtimes get a fresh anchor; no saved wall time is used to catch up.
    this.lastSampleMilliseconds = this.readNow()
  }

  /** Read and advance one world-scoped clock. Scene changes do not reset this runtime. */
  read(): WorldClockSnapshot {
    return this.advanceTo(this.readNow())
  }

  /** Deterministic entry point for adapters and tests with an injected monotonic timestamp. */
  advanceTo(nowMilliseconds: number): WorldClockSnapshot {
    if (!Number.isFinite(nowMilliseconds)) throw new RangeError('nowMilliseconds must be finite')
    if (nowMilliseconds < this.lastSampleMilliseconds) {
      throw new RangeError('monotonic time must not move backwards')
    }

    const elapsedMilliseconds = nowMilliseconds - this.lastSampleMilliseconds
    if (this.state.suspended || elapsedMilliseconds === 0) {
      this.lastSampleMilliseconds = nowMilliseconds
      return this.snapshot()
    }

    // 1 game second = 1,000,000 ticks; real milliseconds convert with * 1,000.
    // Keep fractional ticks so small 0.009x samples are not truncated away.
    const exactTicks = elapsedMilliseconds * this.configuration.rates[this.state.mode] * 1_000
      + this.state.fractionalTickRemainder
    const wholeTicks = Math.floor(exactTicks)
    const nextWorldTimeTicks = this.state.worldTimeTicks + wholeTicks
    if (!Number.isSafeInteger(nextWorldTimeTicks)) {
      throw new RangeError('world time exceeded the safe integer range')
    }

    this.state = {
      ...this.state,
      worldTimeTicks: nextWorldTimeTicks,
      fractionalTickRemainder: exactTicks - wholeTicks,
    }
    // Commit the anchor only after all calculations and validation succeed.
    this.lastSampleMilliseconds = nowMilliseconds
    return this.snapshot()
  }

  /** Settle elapsed time at the previous rate, then switch modes. */
  setMode(mode: WorldClockMode): WorldClockSnapshot {
    if (!isWorldClockMode(mode)) throw new TypeError('Unknown world clock mode')
    const advanced = this.advanceTo(this.readNow())
    this.state = { ...advanced, mode }
    return this.snapshot()
  }

  /** Commit current session time, then freeze until resume(). */
  suspend(): WorldClockSnapshot {
    const advanced = this.advanceTo(this.readNow())
    this.state = { ...advanced, suspended: true }
    return this.snapshot()
  }

  /** Resume from a fresh monotonic anchor; closed-session time is never added. */
  resume(mode?: WorldClockMode): WorldClockSnapshot {
    const now = this.readNow()
    if (now < this.lastSampleMilliseconds) {
      throw new RangeError('monotonic time must not move backwards')
    }
    if (mode !== undefined && !isWorldClockMode(mode)) throw new TypeError('Unknown world clock mode')
    if (!this.state.suspended) {
      const advanced = this.advanceTo(now)
      this.state = { ...advanced, ...(mode ? { mode } : {}) }
      return this.snapshot()
    }

    this.lastSampleMilliseconds = now
    this.state = { ...this.state, suspended: false, ...(mode ? { mode } : {}) }
    return this.snapshot()
  }

  /** Serializable state omits the monotonic anchor by design. */
  snapshot(): WorldClockSnapshot {
    return { ...this.state }
  }

  private readNow() {
    const now = this.timeSource.nowMilliseconds()
    if (!Number.isFinite(now)) throw new RangeError('monotonic source must return a finite number')
    return now
  }
}

export function worldClockView(snapshot: WorldClockSnapshot): WorldClockView {
  const ticksInMinute = WORLD_CLOCK_TICKS_PER_GAME_MINUTE
  const ticksIntoDay = snapshot.worldTimeTicks % WORLD_CLOCK_TICKS_PER_GAME_DAY
  const ticksIntoMinute = ticksIntoDay % ticksInMinute
  return {
    absoluteGameMinutes: snapshot.worldTimeTicks / ticksInMinute,
    dayIndex: Math.floor(snapshot.worldTimeTicks / WORLD_CLOCK_TICKS_PER_GAME_DAY),
    minuteOfDay: Math.floor(ticksIntoDay / ticksInMinute),
    secondOfMinute: ticksIntoMinute / WORLD_CLOCK_TICKS_PER_GAME_SECOND,
    worldTimeTicks: snapshot.worldTimeTicks,
  }
}

/** Adapt any injected monotonic API without coupling this module to browser globals. */
export function monotonicTimeSource(nowMilliseconds: () => number): MonotonicTimeSource {
  return { nowMilliseconds }
}
