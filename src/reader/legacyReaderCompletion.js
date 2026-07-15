export const LEGACY_READER_END_TOLERANCE_PX = 4

export function getRemainingDocumentDistance({ scrollHeight, innerHeight, scrollY }) {
  if (![scrollHeight, innerHeight, scrollY].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY
  }

  return Math.max(scrollHeight - innerHeight - scrollY, 0)
}

export function isAtLegacyReaderDocumentEnd(metrics) {
  return getRemainingDocumentDistance(metrics) <= LEGACY_READER_END_TOLERANCE_PX
}

export function isLegacyReaderDownwardScrollIntent({
  isReaderReady,
  isRestoring,
  ignoreScrollIntent,
  previousScrollY,
  currentScrollY,
}) {
  return isReaderReady === true
    && isRestoring === false
    && ignoreScrollIntent !== true
    && Number.isFinite(previousScrollY)
    && Number.isFinite(currentScrollY)
    && currentScrollY > previousScrollY
}

export function canCompleteLegacyReader({
  isReaderReady,
  isRestoring,
  currentPhase,
  hasUserScrolledDownAfterReady,
  isAtDocumentEnd,
  isSentinelAtEnd,
  readerCompleted,
  centerUnlocked,
  completionCommitted,
}) {
  return isReaderReady === true
    && isRestoring === false
    && currentPhase === 'M4'
    && hasUserScrolledDownAfterReady === true
    && isAtDocumentEnd === true
    && isSentinelAtEnd === true
    && readerCompleted !== true
    && centerUnlocked !== true
    && completionCommitted !== true
}
