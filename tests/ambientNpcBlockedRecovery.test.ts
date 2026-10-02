import { describe, expect, it } from 'vitest'
import {
  ambientNpcBlockedRecoveryDecision,
  ambientNpcBlockedRecoveryDelayMs,
  ambientNpcBlockedRetryLimit,
} from '../src/center/runtime/AmbientNpcMotion'

describe('ambient NPC blocked recovery', () => {
  it('leaves normal movement transitions outside recovery', () => {
    expect(ambientNpcBlockedRecoveryDecision('moving', 'idle', 0)).toBeNull()
    expect(ambientNpcBlockedRecoveryDecision('idle', 'moving', 0)).toBeNull()
  })

  it('clears the requested step and permits one scene-clock retry after a live blockage', () => {
    expect(ambientNpcBlockedRecoveryDecision('moving', 'blocked', 0)).toEqual({
      kind: 'retry',
      clearRequested: true,
      retryCount: 1,
      delayMs: ambientNpcBlockedRecoveryDelayMs,
    })
  })

  it('skips a persistently blocked step at the retry limit instead of retrying indefinitely', () => {
    expect(ambientNpcBlockedRetryLimit).toBe(1)
    expect(ambientNpcBlockedRecoveryDecision('moving', 'blocked', ambientNpcBlockedRetryLimit)).toEqual({
      kind: 'skip',
      clearRequested: true,
      retryCount: ambientNpcBlockedRetryLimit,
    })
  })
})
