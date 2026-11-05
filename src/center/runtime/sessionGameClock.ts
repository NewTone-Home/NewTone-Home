import { createGameClock, type GameClock, type GameClockSnapshot } from './gameClock'
import {
  gameClockActivityMode,
  gameClockMultiplierForActivity,
  type GameClockActivityMode,
  type GameClockActivitySource,
  type GameClockRateInputs,
} from './gameClockActivity'

export type SessionGameActivitySource = Exclude<GameClockActivitySource, 'idle' | 'closed'>

export type SessionGameClockSnapshot = GameClockSnapshot & {
  activity: GameClockActivitySource
  activityMode: GameClockActivityMode
  idle: boolean
}

export type CreateSessionGameClockOptions = {
  /** Approved free-version rates are explicit inputs so tests can inject alternatives. */
  rates: GameClockRateInputs
  /** Inactivity threshold is also mandatory; no production threshold is assumed. */
  idleAfterMs: number
  now?: () => number
  initialGameTimeMs?: number
}

export type SessionGameClock = {
  read(): SessionGameClockSnapshot
  /** Add/update/remove one uniquely identified page activity; cleanup only removes that source. */
  setActivitySource(sourceId: string, source: SessionGameActivitySource | null): SessionGameClockSnapshot
  /** A trusted user action resets idle and restores the latest semantic activity rate. */
  markInput(): SessionGameClockSnapshot
  /** Freeze/resume one named reason without changing the semantic activity or idle deadline. */
  setFrozen(reason: string, frozen: boolean): SessionGameClockSnapshot
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

  let activity: Exclude<GameClockActivitySource, 'closed'> = 'normal-play'
  let isIdle = false
  let isClosed = false
  let lastInputAtMs = lastObservedTimeMs
  const activitySources = new Map<string, SessionGameActivitySource>()
  const clock: GameClock = createGameClock({
    now,
    multiplier: gameClockMultiplierForActivity(activity, options.rates),
    initialGameTimeMs: options.initialGameTimeMs,
  })

  function snapshot(clockSnapshot: GameClockSnapshot): SessionGameClockSnapshot {
    return {
      ...clockSnapshot,
      activity,
      activityMode: isClosed ? 'closed' : isIdle ? 'idle' : gameClockActivityMode(activity),
      idle: isIdle,
    }
  }

  function prioritizedActivity(): Exclude<GameClockActivitySource, 'closed'> {
    const sources = [...activitySources.values()]
    return sources.find(source => gameClockActivityMode(source) === 'dialogue')
      ?? sources.find(source => gameClockActivityMode(source) === 'ordinary-reading')
      ?? 'normal-play'
  }

  function applyActivityRate(atMs: number) {
    const rate = isIdle ? options.rates.idle : gameClockMultiplierForActivity(activity, options.rates)
    clock.setMultiplier(rate, atMs)
  }

  function applyIdleDeadline(atMs: number) {
    validateTime(atMs)
    if (isClosed || isIdle) return
    const idleAtMs = lastInputAtMs + options.idleAfterMs
    if (atMs < idleAtMs) return
    clock.setMultiplier(options.rates.idle, idleAtMs)
    isIdle = true
  }

  function assertOpen() {
    if (isClosed) throw new Error('A closed session clock cannot change activity')
  }

  return {
    read() {
      const atMs = now()
      applyIdleDeadline(atMs)
      return snapshot(clock.read(atMs))
    },
    setActivitySource(sourceId, source) {
      assertOpen()
      if (!sourceId.trim()) throw new TypeError('An activity source id is required')
      const atMs = now()
      applyIdleDeadline(atMs)
      if (source === null) activitySources.delete(sourceId)
      else activitySources.set(sourceId, source)
      const nextActivity = prioritizedActivity()
      if (nextActivity !== activity) {
        activity = nextActivity
        applyActivityRate(atMs)
      }
      return snapshot(clock.read(atMs))
    },
    markInput() {
      assertOpen()
      const atMs = now()
      applyIdleDeadline(atMs)
      lastInputAtMs = atMs
      if (isIdle) {
        isIdle = false
        applyActivityRate(atMs)
      }
      return snapshot(clock.read(atMs))
    },
    setFrozen(reason, frozen) {
      assertOpen()
      const atMs = now()
      applyIdleDeadline(atMs)
      clock.setFrozen(reason, frozen, atMs)
      return snapshot(clock.read(atMs))
    },
    close() {
      if (isClosed) return snapshot(clock.read(now()))
      const atMs = now()
      applyIdleDeadline(atMs)
      clock.setMultiplier(0, atMs)
      clock.setFrozen('session-closed', true, atMs)
      isClosed = true
      return snapshot(clock.read(atMs))
    },
  }
}

/**
 * Freeze world time while the page is not visible or is in the pagehide lifecycle.
 * Separate reasons make visibilitychange/pageshow ordering safe and duplicate events idempotent.
 */
export function attachSessionGameClockVisibilityLifecycle(
  sessionClock: SessionGameClock,
  onSnapshot: (snapshot: SessionGameClockSnapshot) => void = () => undefined,
  windowTarget: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  documentTarget: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> = document,
) {
  const onVisibilityChange = () => {
    onSnapshot(sessionClock.setFrozen('document-hidden', documentTarget.visibilityState === 'hidden'))
  }
  const onPageHide = () => onSnapshot(sessionClock.setFrozen('page-hidden', true))
  const onPageShow = () => onSnapshot(sessionClock.setFrozen('page-hidden', false))

  documentTarget.addEventListener('visibilitychange', onVisibilityChange)
  windowTarget.addEventListener('pagehide', onPageHide)
  windowTarget.addEventListener('pageshow', onPageShow)
  onVisibilityChange()

  return () => {
    documentTarget.removeEventListener('visibilitychange', onVisibilityChange)
    windowTarget.removeEventListener('pagehide', onPageHide)
    windowTarget.removeEventListener('pageshow', onPageShow)
  }
}
