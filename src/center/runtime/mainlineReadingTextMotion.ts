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
