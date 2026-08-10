import { describe, expect, it } from 'vitest'
import {
  advanceUpdatesPhase,
  resolveTouchReturnSwipe,
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
    expect(phase).toBe(UPDATES_PHASE.RETURN_ARROW_TURN)
    phase = advanceUpdatesPhase(phase, 'turns-complete')
    expect(phase).toBe(UPDATES_PHASE.LANDING)
  })

  it('requires a fresh upward touch gesture after the mobile return is armed and ready', () => {
    expect(resolveTouchReturnSwipe({ armed: false, ready: true, pointerType: 'touch', startY: 500, endY: 440 })).toBe(false)
    expect(resolveTouchReturnSwipe({ armed: true, ready: false, pointerType: 'touch', startY: 500, endY: 440 })).toBe(false)
    expect(resolveTouchReturnSwipe({ armed: true, ready: true, pointerType: 'touch', startY: 500, endY: 475 })).toBe(false)
    expect(resolveTouchReturnSwipe({ armed: true, ready: true, pointerType: 'touch', startY: 500, endY: 440 })).toBe(true)
    expect(resolveTouchReturnSwipe({ armed: true, ready: true, pointerType: 'touch', startY: 440, endY: 500 })).toBe(false)
  })
})
