/**
 * Simulation-time accumulator. It deliberately knows nothing about story dates,
 * save files, browser visibility, or rendering; callers supply a monotonic clock.
 */
export type GameClockSnapshot = {
  gameTimeMs: number
  multiplier: number
  freezeReasons: readonly string[]
  frozen: boolean
}

export type GameClock = {
  read(): GameClockSnapshot
  setMultiplier(multiplier: number): GameClockSnapshot
  setFrozen(reason: string, frozen: boolean): GameClockSnapshot
}

export type CreateGameClockOptions = {
  /** Normal-play trial baseline. Reading profiles can explicitly set another rate. */
  multiplier?: number
  /** Injected monotonic source makes the clock deterministic in tests. */
  now?: () => number
  initialGameTimeMs?: number
}

function validateMultiplier(multiplier: number) {
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new RangeError('Game clock multiplier must be a finite, non-negative number')
  }
}

function validateReason(reason: string) {
  if (!reason.trim()) throw new TypeError('A game clock freeze reason is required')
}

function validateRealTime(realTimeMs: number) {
  if (!Number.isFinite(realTimeMs)) throw new RangeError('Monotonic time must be finite')
}

export function createGameClock(options: CreateGameClockOptions = {}): GameClock {
  const now = options.now ?? (() => performance.now())
  let lastRealTimeMs = now()
  validateRealTime(lastRealTimeMs)
  let gameTimeMs = options.initialGameTimeMs ?? 0
  let multiplier = options.multiplier ?? 30
  validateMultiplier(multiplier)
  if (!Number.isFinite(gameTimeMs) || gameTimeMs < 0) {
    throw new RangeError('Initial game time must be a finite, non-negative number')
  }
  const freezeReasons = new Set<string>()

  function advanceTo(realTimeMs: number) {
    validateRealTime(realTimeMs)
    const nextRealTimeMs = Math.max(lastRealTimeMs, realTimeMs)
    const elapsedRealMs = nextRealTimeMs - lastRealTimeMs
    const nextGameTimeMs = freezeReasons.size === 0
      ? gameTimeMs + elapsedRealMs * multiplier
      : gameTimeMs
    if (!Number.isFinite(nextGameTimeMs)) throw new RangeError('Game clock accumulation must remain finite')
    lastRealTimeMs = nextRealTimeMs
    gameTimeMs = nextGameTimeMs
  }

  function snapshot(): GameClockSnapshot {
    return {
      gameTimeMs,
      multiplier,
      freezeReasons: [...freezeReasons],
      frozen: freezeReasons.size > 0,
    }
  }

  return {
    read() {
      advanceTo(now())
      return snapshot()
    },
    setMultiplier(nextMultiplier) {
      validateMultiplier(nextMultiplier)
      advanceTo(now())
      multiplier = nextMultiplier
      return snapshot()
    },
    setFrozen(reason, frozen) {
      validateReason(reason)
      advanceTo(now())
      if (frozen) freezeReasons.add(reason)
      else freezeReasons.delete(reason)
      return snapshot()
    },
  }
}
