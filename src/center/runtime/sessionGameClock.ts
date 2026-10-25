import { createGameClock, type GameClock, type GameClockSnapshot } from './gameClock'
import {
  gameClockActivityMode,
  gameClockMultiplierForActivity,
  type GameClockActivityMode,
  type GameClockActivitySource,
  type GameClockEdition,
  type GameClockRateInputs,
} from './gameClockActivity'

export type SessionGameActivitySource = Exclude<GameClockActivitySource, 'idle' | 'closed'>

export type SessionGameClockSnapshot = GameClockSnapshot & {
  activity: GameClockActivitySource
  activityMode: GameClockActivityMode
}

export type CreateSessionGameClockOptions = {
  edition: GameClockEdition
  /** Product-undefined rates are mandatory inputs; this factory supplies none. */
  rates: GameClockRateInputs
  /** Inactivity threshold is also mandatory; no production threshold is assumed. */
  idleAfterMs: number
  now?: () => number
  initialGameTimeMs?: number
}

export type SessionGameClock = {
  read(): SessionGameClockSnapshot
  /** Set an explicit scene/UI activity category; ordinary reading suppresses idle. */
  setActivity(source: SessionGameActivitySource): SessionGameClockSnapshot
  /** Report a player input; it resets idle timing without overriding active reading. */
  markInput(): SessionGameClockSnapshot
  /** Freeze this in-memory session. A later session must be created separately. */
  close(): SessionGameClockSnapshot
}

function validateTime(value: number) {
  if (!Number.isFinite(value)) throw new RangeError('Monotonic time must be finite')
}

export function createSessionGameClock(options: CreateSessionGameClockOptions): SessionGameClock {
  if (!Number.isFinite(options.idleAfterMs) || options.idleAfterMs < 0) {
    throw new RangeError('Idle threshold must be a finite, non-negative number')
  }

  const readSourceTime = options.now ?? (() => performance.now())
  let lastObservedTimeMs = readSourceTime()
  validateTime(lastObservedTimeMs)
  const now = () => {
    const sample = readSourceTime()
    validateTime(sample)
    lastObservedTimeMs = Math.max(lastObservedTimeMs, sample)
    return lastObservedTimeMs
  }

  let activity: GameClockActivitySource = 'normal-play'
  let lastInputAtMs = lastObservedTimeMs
  const clock: GameClock = createGameClock({
    now,
    multiplier: gameClockMultiplierForActivity(options.edition, activity, options.rates),
    initialGameTimeMs: options.initialGameTimeMs,
  })

  function snapshot(clockSnapshot: GameClockSnapshot): SessionGameClockSnapshot {
    return {
      ...clockSnapshot,
      activity,
      activityMode: gameClockActivityMode(activity),
    }
  }

  function applyIdleDeadline(atMs: number) {
    validateTime(atMs)
    if (activity !== 'normal-play') return
    const idleAtMs = lastInputAtMs + options.idleAfterMs
    if (atMs < idleAtMs) return
    clock.setMultiplier(gameClockMultiplierForActivity(options.edition, 'idle', options.rates), idleAtMs)
    activity = 'idle'
  }

  function assertOpen() {
    if (activity === 'closed') throw new Error('A closed session clock cannot change activity')
  }

  return {
    read() {
      const atMs = now()
      applyIdleDeadline(atMs)
      return snapshot(clock.read(atMs))
    },
    setActivity(source) {
      assertOpen()
      const atMs = now()
      applyIdleDeadline(atMs)
      const rate = gameClockMultiplierForActivity(options.edition, source, options.rates)
      clock.setMultiplier(rate, atMs)
      activity = source
      if (source === 'normal-play') lastInputAtMs = atMs
      return snapshot(clock.read(atMs))
    },
    markInput() {
      assertOpen()
      const atMs = now()
      applyIdleDeadline(atMs)
      lastInputAtMs = atMs
      if (activity === 'idle') {
        const rate = gameClockMultiplierForActivity(options.edition, 'normal-play', options.rates)
        clock.setMultiplier(rate, atMs)
        activity = 'normal-play'
      }
      return snapshot(clock.read(atMs))
    },
    close() {
      if (activity === 'closed') return snapshot(clock.read(now()))
      const atMs = now()
      applyIdleDeadline(atMs)
      clock.setMultiplier(0, atMs)
      clock.setFrozen('session-closed', true, atMs)
      activity = 'closed'
      return snapshot(clock.read(atMs))
    },
  }
}
