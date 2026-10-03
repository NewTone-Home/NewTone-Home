export const SESSION_IDLE_THRESHOLD_MS = 30_000
export const SESSION_CHECKPOINT_INTERVAL_MS = 15_000

const nonNegative = (value) => Math.max(0, Math.floor(value))

export function createSessionClockState({
  startedAt = 0,
  lastAccountedAt = startedAt,
  lastMeaningfulActivityAt = lastAccountedAt,
  foreground = true,
  moving = false,
  reading = false,
  phoneOpen = false,
  totals = {},
} = {}) {
  return {
    startedAt,
    lastAccountedAt,
    lastMeaningfulActivityAt,
    foreground: Boolean(foreground),
    moving: Boolean(moving),
    reading: Boolean(reading),
    phoneOpen: Boolean(phoneOpen),
    elapsedMs: nonNegative(totals.elapsedMs ?? 0),
    foregroundMs: nonNegative(totals.foregroundMs ?? 0),
    engagedMs: nonNegative(totals.engagedMs ?? 0),
    idleMs: nonNegative(totals.idleMs ?? 0),
    movementMs: nonNegative(totals.movementMs ?? 0),
    readingMs: nonNegative(totals.readingMs ?? 0),
    phoneMs: nonNegative(totals.phoneMs ?? 0),
    lastCheckpointAt: nonNegative(totals.lastCheckpointAt ?? startedAt),
    sceneId: totals.sceneId ?? null,
  }
}

/** Settle the ledger once, using the state that was active for the interval. */
export function advanceSessionClock(state, now) {
  const at = Math.max(state.lastAccountedAt, Number.isFinite(now) ? now : state.lastAccountedAt)
  const delta = at - state.lastAccountedAt
  const foregroundDelta = state.foreground ? delta : 0
  const idleEligible = state.foreground && !state.moving && !state.reading
  const idleStart = Math.max(state.lastAccountedAt, state.lastMeaningfulActivityAt + SESSION_IDLE_THRESHOLD_MS)
  const idleDelta = idleEligible ? Math.max(0, at - idleStart) : 0
  const engagedDelta = Math.max(0, foregroundDelta - idleDelta)

  return {
    ...state,
    lastAccountedAt: at,
    elapsedMs: Math.max(state.elapsedMs, at - state.startedAt),
    foregroundMs: state.foregroundMs + foregroundDelta,
    engagedMs: state.engagedMs + engagedDelta,
    idleMs: state.idleMs + idleDelta,
    movementMs: state.movementMs + (state.foreground && state.moving ? delta : 0),
    readingMs: state.readingMs + (state.foreground && state.reading ? delta : 0),
    phoneMs: state.phoneMs + (state.foreground && state.phoneOpen ? delta : 0),
  }
}

function snapshotOf(state) {
  return {
    startedAt: nonNegative(state.startedAt),
    lastAccountedAt: nonNegative(state.lastAccountedAt),
    lastCheckpointAt: nonNegative(state.lastCheckpointAt),
    elapsedMs: nonNegative(state.elapsedMs),
    foregroundMs: nonNegative(state.foregroundMs),
    engagedMs: Math.min(nonNegative(state.foregroundMs), nonNegative(state.engagedMs)),
    idleMs: Math.min(nonNegative(state.foregroundMs), nonNegative(state.idleMs)),
    movementMs: nonNegative(state.movementMs),
    readingMs: nonNegative(state.readingMs),
    phoneMs: nonNegative(state.phoneMs),
    sceneId: state.sceneId,
    visible: state.foreground,
    moving: state.moving,
    reading: state.reading,
    phoneOpen: state.phoneOpen,
    lastMeaningfulActivityAt: state.lastMeaningfulActivityAt,
  }
}

/**
 * Event-driven session ledger. It only settles time when a real owner reports
 * an activity/state/visibility/position/scene event; it never creates ticks.
 */
export function createSessionActivityTracker({
  now = () => Date.now(),
  startedAt = now(),
  lastAt = now(),
  initialTotals = {},
  onCheckpoint = () => {},
  onReadingTransition = () => {},
  onPhoneTransition = () => {},
  onMovementTransition = () => {},
} = {}) {
  let state = createSessionClockState({
    startedAt,
    lastAccountedAt: lastAt,
    lastMeaningfulActivityAt: Number.isFinite(initialTotals.lastMeaningfulActivityAt)
      ? initialTotals.lastMeaningfulActivityAt
      : lastAt,
    foreground: typeof document === 'undefined' || document.visibilityState !== 'hidden',
    totals: initialTotals,
  })
  let disposed = false

  const settle = (at = now()) => {
    if (disposed) return snapshotOf(state)
    state = advanceSessionClock(state, at)
    return snapshotOf(state)
  }

  const checkpointIfDue = (at = now(), { force = false, keepalive = false } = {}) => {
    if (disposed) return false
    settle(at)
    if (!force && at - state.lastCheckpointAt < SESSION_CHECKPOINT_INTERVAL_MS) return false
    state = { ...state, lastCheckpointAt: at }
    onCheckpoint(snapshotOf(state), { force, keepalive })
    return true
  }

  const markActivity = (at = now()) => {
    if (disposed) return false
    settle(at)
    state = { ...state, lastMeaningfulActivityAt: at }
    checkpointIfDue(at)
    return true
  }

  const transition = (key, next, at, callback) => {
    if (disposed) return false
    settle(at)
    const normalized = Boolean(next)
    if (normalized === state[key]) return false
    const before = state
    state = { ...state, [key]: normalized }
    const snapshot = snapshotOf(state)
    callback?.(normalized, snapshot, snapshotOf(before))
    checkpointIfDue(at, { force: key === 'foreground' && !normalized, keepalive: key === 'foreground' && !normalized })
    return true
  }

  const setScene = (sceneId, at = now()) => {
    if (disposed) return false
    settle(at)
    const normalized = sceneId ?? null
    if (normalized === state.sceneId) return false
    state = { ...state, sceneId: normalized }
    checkpointIfDue(at)
    return true
  }

  const checkpoint = (at = now(), options = {}) => checkpointIfDue(at, options)
  const snapshot = (at = now()) => {
    settle(at)
    return snapshotOf(state)
  }
  const dispose = () => { disposed = true }

  return {
    advance: settle,
    checkpoint,
    checkpointIfDue,
    dispose,
    isDisposed: () => disposed,
    markActivity,
    setMoving: (next, at = now()) => transition('moving', next, at, onMovementTransition),
    setPhoneOpen: (next, at = now()) => transition('phoneOpen', next, at, onPhoneTransition),
    setReading: (next, at = now()) => transition('reading', next, at, onReadingTransition),
    setScene,
    setVisible: (next, at = now(), options = {}) => transition('foreground', next, at, () => {
      if (next) state = { ...state, lastMeaningfulActivityAt: at }
    }, options),
    snapshot,
  }
}
