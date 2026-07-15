import { describe, expect, it } from 'vitest'
import {
  LEGACY_READER_END_TOLERANCE_PX,
  canCompleteLegacyReader,
  getRemainingDocumentDistance,
  isAtLegacyReaderDocumentEnd,
  isLegacyReaderDownwardScrollIntent,
} from '../src/reader/legacyReaderCompletion'

const eligible = {
  isReaderReady: true,
  isRestoring: false,
  currentPhase: 'M4',
  hasUserScrolledDownAfterReady: true,
  isAtDocumentEnd: true,
  isSentinelAtEnd: true,
  readerCompleted: false,
  centerUnlocked: false,
  completionCommitted: false,
}

describe('legacy Reader completion eligibility', () => {
  it('does not complete while restoration is in progress', () => {
    expect(canCompleteLegacyReader({ ...eligible, isRestoring: true })).toBe(false)
  })

  it('does not complete before Reader ready', () => {
    expect(canCompleteLegacyReader({ ...eligible, isReaderReady: false })).toBe(false)
  })

  it('does not complete without a downward user intent after ready', () => {
    expect(canCompleteLegacyReader({
      ...eligible,
      hasUserScrolledDownAfterReady: false,
    })).toBe(false)
  })

  it('does not complete before the real document end', () => {
    expect(canCompleteLegacyReader({ ...eligible, isAtDocumentEnd: false })).toBe(false)
  })

  it('does not complete when the sentinel is not at the end boundary', () => {
    expect(canCompleteLegacyReader({ ...eligible, isSentinelAtEnd: false })).toBe(false)
  })

  it('does not complete M3 at the document end', () => {
    expect(canCompleteLegacyReader({ ...eligible, currentPhase: 'M3' })).toBe(false)
  })

  it('completes M4 only when ready, user-driven, and at the real end', () => {
    expect(canCompleteLegacyReader(eligible)).toBe(true)
  })

  it('does not repeat completion after the persisted state is complete', () => {
    expect(canCompleteLegacyReader({ ...eligible, readerCompleted: true })).toBe(false)
    expect(canCompleteLegacyReader({ ...eligible, centerUnlocked: true })).toBe(false)
  })

  it('does not repeat completion after the session ref is committed', () => {
    expect(canCompleteLegacyReader({ ...eligible, completionCommitted: true })).toBe(false)
  })

  it('does not complete after resize without a user intent', () => {
    expect(canCompleteLegacyReader({
      ...eligible,
      hasUserScrolledDownAfterReady: false,
      isAtDocumentEnd: true,
      isSentinelAtEnd: true,
    })).toBe(false)
  })

  it('does not repeat completion during a StrictMode-style effect replay', () => {
    const firstPass = canCompleteLegacyReader(eligible)
    const replay = canCompleteLegacyReader({
      ...eligible,
      completionCommitted: firstPass,
    })

    expect(firstPass).toBe(true)
    expect(replay).toBe(false)
  })
})

describe('legacy Reader completion boundary', () => {
  it('uses a named pixel tolerance at the document end', () => {
    const metrics = { scrollHeight: 3415, innerHeight: 720, scrollY: 2691 }

    expect(getRemainingDocumentDistance(metrics)).toBe(LEGACY_READER_END_TOLERANCE_PX)
    expect(isAtLegacyReaderDocumentEnd(metrics)).toBe(true)
    expect(isAtLegacyReaderDocumentEnd({ ...metrics, scrollY: 2690 })).toBe(false)
  })

  it('rejects invalid measurements safely', () => {
    expect(isAtLegacyReaderDocumentEnd({
      scrollHeight: Number.NaN,
      innerHeight: 720,
      scrollY: 0,
    })).toBe(false)
  })
})

describe('legacy Reader downward scroll intent', () => {
  const downward = {
    isReaderReady: true,
    isRestoring: false,
    ignoreScrollIntent: false,
    previousScrollY: 2670,
    currentScrollY: 2695,
  }

  it('accepts a real downward position change after ready', () => {
    expect(isLegacyReaderDownwardScrollIntent(downward)).toBe(true)
  })

  it('rejects restoration and pre-ready position changes', () => {
    expect(isLegacyReaderDownwardScrollIntent({ ...downward, isRestoring: true })).toBe(false)
    expect(isLegacyReaderDownwardScrollIntent({ ...downward, isReaderReady: false })).toBe(false)
  })

  it('rejects resize/layout suppression windows', () => {
    expect(isLegacyReaderDownwardScrollIntent({
      ...downward,
      ignoreScrollIntent: true,
    })).toBe(false)
  })

  it('rejects stationary and upward scroll changes', () => {
    expect(isLegacyReaderDownwardScrollIntent({
      ...downward,
      currentScrollY: downward.previousScrollY,
    })).toBe(false)
    expect(isLegacyReaderDownwardScrollIntent({
      ...downward,
      currentScrollY: downward.previousScrollY - 1,
    })).toBe(false)
  })
})
