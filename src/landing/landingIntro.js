export const INTRO_STORAGE_KEY = 'newtone-landing-intro-v1'

/**
 * Visual state of the title mark on *this* page view. It is deliberately
 * independent of whatever is in storage: the persisted flag below says whether
 * the visitor has learned the entry gesture, never what the title looks like
 * right now. Keeping them apart is what lets the persisted half move to an
 * account later without touching any of the animation code.
 *
 *   idle        淡稿, nothing retraced
 *   drawing     the stroke is running (identical on a first and a tenth visit)
 *   revealed    the stroke landed, ink held, prompt earned
 *   retracting  the stroke is being pulled back along its own path
 */
export const TITLE_PHASE = Object.freeze({
  IDLE: 'idle',
  DRAWING: 'drawing',
  REVEALED: 'revealed',
  RETRACTING: 'retracting',
})

/** Discovery is slow enough to be felt — a hand writing, not a UI easing. */
export const TITLE_DRAW_MS = 2000
/** Leaving is not — the stroke is snatched back. */
export const TITLE_RETRACT_MS = 320
/** The first visit begins quietly before the teaching mark appears. */
export const LANDING_GUIDE_DELAY_MS = 1200
/** The guide withdraws before the title retrace begins. */
export const LANDING_GUIDE_RETRACT_MS = 320

export function shouldScheduleLandingGuide({ introCompleted, phase, activationPending = false }) {
  return !introCompleted && phase === TITLE_PHASE.IDLE && !activationPending
}

function defaultStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readIntroCompleted(storage = defaultStorage()) {
  try {
    return storage?.getItem(INTRO_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function writeIntroCompleted(storage = defaultStorage()) {
  try {
    storage?.setItem(INTRO_STORAGE_KEY, 'true')
  } catch {
    // Private mode: the intro simply plays again next visit.
  }
}

export function clearIntroCompleted(storage = defaultStorage()) {
  try {
    storage?.removeItem(INTRO_STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}

export function isTitleDrawing(phase) {
  return phase === TITLE_PHASE.DRAWING
}

/**
 * What a scroll should do right now — the one place the persisted flag and the
 * visual phase are allowed to meet.
 *   blocked  the intro has not been learned yet — the wheel does nothing at all,
 *            and in particular it never cancels the stroke in flight
 *   retract  a stroke is running for someone who already knows the rule:
 *            pull it back first, then leave
 *   ignore   a retract is already underway
 *   enter    leave immediately
 */
export function resolveScrollIntent({ phase, introCompleted }) {
  if (!introCompleted) return 'blocked'
  if (isTitleDrawing(phase)) return 'retract'
  if (phase === TITLE_PHASE.RETRACTING) return 'ignore'
  return 'enter'
}
