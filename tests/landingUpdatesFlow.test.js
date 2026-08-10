import { describe, expect, it } from 'vitest'
import {
  advanceUpdatesPhase,
  resolveTouchReturnAction,
  UPDATES_PHASE,
} from '../src/landing/landingUpdatesFlow'

describe('Landing updates flow', () => {
  it('enters only in the three contracted completion barriers', () => {
    let phase = advanceUpdatesPhase(UPDATES_PHASE.LANDING, 'enter-requested')
    expect(phase).toBe(UPDATES_PHASE.ENTER_ARROWS)
    expect(advanceUpdatesPhase(phase, 'labels-complete')).toBe(phase)
    phase = advanceUpdatesPhase(phase, 'arrows-complete')
    expect(phase).toBe(UPDATES_PHASE.ENTER_LABELS)
    phase = advanceUpdatesPhase(phase, 'labels-complete')
    expect(phase).toBe(UPDATES_PHASE.ENTER_SURFACE)
    phase = advanceUpdatesPhase(phase, 'surface-complete')
    expect(phase).toBe(UPDATES_PHASE.UPDATES)
  })

  it('returns through the exact inverse barriers and ignores duplicate input', () => {
    let phase = advanceUpdatesPhase(UPDATES_PHASE.UPDATES, 'return-requested')
    expect(phase).toBe(UPDATES_PHASE.RETURN_SURFACE)
    expect(advanceUpdatesPhase(phase, 'return-requested')).toBe(phase)
    phase = advanceUpdatesPhase(phase, 'surface-complete')
    expect(phase).toBe(UPDATES_PHASE.RETURN_LABELS)
    phase = advanceUpdatesPhase(phase, 'labels-complete')
    expect(phase).toBe(UPDATES_PHASE.RETURN_ARROWS)
    phase = advanceUpdatesPhase(phase, 'arrows-complete')
    expect(phase).toBe(UPDATES_PHASE.LANDING)
  })

  it('requires the mobile return entrance to arm before a ready second tap', () => {
    expect(resolveTouchReturnAction({ armed: false, ready: false })).toBe('arm')
    expect(resolveTouchReturnAction({ armed: true, ready: false })).toBe('wait')
    expect(resolveTouchReturnAction({ armed: true, ready: true })).toBe('return')
  })
})
