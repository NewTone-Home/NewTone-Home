export type MainlineReadingTextMotion = 'typing' | 'static' | 'deleting' | 'deleted'

export function mainlineReadingTextMotionCanAnimate(motion: MainlineReadingTextMotion, pageSettled: boolean) {
  return pageSettled && (motion === 'typing' || motion === 'deleting')
}

export function mainlineReadingTextMotionVisibleCount(motion: 'typing' | 'deleting', textLength: number, elapsedMs: number, intervalMs: number) {
  const elapsedSteps = Math.floor(Math.max(0, elapsedMs) / Math.max(1, intervalMs))
  return motion === 'typing'
    ? Math.min(textLength, elapsedSteps + 1)
    : Math.max(0, textLength - elapsedSteps - 1)
}

export function mainlineReadingTextMotionCompletionMatches(currentSessionKey: string, callbackSessionKey: string) {
  return currentSessionKey === callbackSessionKey
}

/** Uses authored session text/segment indices only; fitted viewport pages are intentionally excluded. */
export function mainlineReadingSessionTextIsFinal(textIndex: number, textCount: number, segmentIndex: number, segmentCount: number) {
  return textCount > 0 && segmentCount > 0
    && textIndex + 1 >= textCount
    && segmentIndex + 1 >= segmentCount
}

/** A newly opened reading session animates its opening text exactly once. */
export function mainlineReadingTextMotionAfterAdvance(
  current: MainlineReadingTextMotion,
  isSessionEnd: boolean,
): MainlineReadingTextMotion {
  if (current === 'typing') return 'static'
  if (current === 'deleting' || current === 'deleted') return current
  return isSessionEnd ? 'deleting' : 'static'
}

export function mainlineReadingTextMotionAfterAnimation(
  current: MainlineReadingTextMotion,
): MainlineReadingTextMotion {
  if (current === 'typing') return 'static'
  if (current === 'deleting') return 'deleted'
  return current
}

/** Continue from the number of characters visible when motion was paused. */
export function mainlineReadingTextMotionResumeElapsed(motion: 'typing' | 'deleting', textLength: number, visibleCount: number, intervalMs: number) {
  const count = Math.max(0, Math.min(textLength, visibleCount))
  const steps = motion === 'typing' ? Math.max(0, count - 1) : Math.max(0, textLength - count - 1)
  return steps * Math.max(1, intervalMs)
}

/** Start one resumable frame loop; cancellation or pause suppresses completion. */
export function startMainlineReadingTextMotion(input: {
  motion: 'typing' | 'deleting'; textLength: number; visibleCount: number; intervalMs: number
  request: (callback: (now: number) => void) => number; cancel: (id: number) => void
  isPaused: () => boolean; onProgress: (count: number) => void; onComplete: () => void
}) {
  let frame = 0
  let cancelled = false
  let startedAt: number | null = null
  const baseline = mainlineReadingTextMotionResumeElapsed(input.motion, input.textLength, input.visibleCount, input.intervalMs)
  const advance = (now: number) => {
    if (cancelled || input.isPaused()) return
    startedAt ??= now
    const next = mainlineReadingTextMotionVisibleCount(input.motion, input.textLength, baseline + now - startedAt, input.intervalMs)
    input.onProgress(next)
    if (input.motion === 'typing' ? next >= input.textLength : next <= 0) {
      if (!cancelled && !input.isPaused()) input.onComplete()
    } else frame = input.request(advance)
  }
  if (input.textLength === 0) { if (!input.isPaused()) input.onComplete() }
  else frame = input.request(advance)
  return () => { cancelled = true; input.cancel(frame) }
}

/** Allow the first measured background region to soften before the first glyph appears. */
export const mainlineReadingTypingDelayMs = 140
export const mainlineReadingMaskReleaseDelayMs = 120
