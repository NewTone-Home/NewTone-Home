import { describe, expect, it } from 'vitest'
import {
  advanceUpdatesPhase,
  resolveUpdatesTouchIntent,
  resolveUpdatesWheelIntent,
  resolveTouchReturnSwipe,
  UPDATE_RETURN_INTENTS,
  UPDATES_PHASE,
} from '../src/landing/landingUpdatesFlow'

describe('Landing updates flow', () => {
  it('enters after the turn and shared arrow/text exit barriers', () => {
    let phase = advanceUpdatesPhase(UPDATES_PHASE.LANDING, 'enter-requested')
    expect(phase).toBe(UPDATES_PHASE.ENTER_ARROW_TURN)
    phase = advanceUpdatesPhase(phase, 'turns-complete')
    expect(phase).toBe(UPDATES_PHASE.ENTER_ARROWS)
    expect(advanceUpdatesPhase(phase, 'labels-complete')).toBe(phase)
    phase = advanceUpdatesPhase(phase, 'arrows-complete')
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

  it('requires a fresh downward touch gesture after the mobile return is armed and ready', () => {
    expect(resolveTouchReturnSwipe({ armed: false, ready: true, pointerType: 'touch', startY: 500, endY: 560 })).toBe(false)
    expect(resolveTouchReturnSwipe({ armed: true, ready: false, pointerType: 'touch', startY: 500, endY: 560 })).toBe(false)
    expect(resolveTouchReturnSwipe({ armed: true, ready: true, pointerType: 'touch', startY: 500, endY: 525 })).toBe(false)
    expect(resolveTouchReturnSwipe({ armed: true, ready: true, pointerType: 'touch', startY: 500, endY: 560 })).toBe(true)
    expect(resolveTouchReturnSwipe({ armed: true, ready: true, pointerType: 'touch', startY: 560, endY: 500 })).toBe(false)
  })

  it('keeps mobile return direction and cancellation explicit', () => {
    expect(resolveUpdatesWheelIntent({ isCoarse: true, phase: 'ready', armed: false, ready: true, deltaY: 12 })).toBeNull()
    expect(resolveUpdatesWheelIntent({ isCoarse: true, phase: 'ready', armed: true, ready: true, deltaY: 12 })).toBe(UPDATE_RETURN_INTENTS.RETURN)
    expect(resolveUpdatesWheelIntent({ isCoarse: true, phase: 'ready', armed: true, ready: true, deltaY: -12 })).toBe(UPDATE_RETURN_INTENTS.CANCEL)
    expect(resolveUpdatesWheelIntent({ isCoarse: false, phase: 'ready', deltaY: -12 })).toBe(UPDATE_RETURN_INTENTS.RETURN)
    expect(resolveUpdatesWheelIntent({ isCoarse: false, phase: 'ready', deltaY: 12 })).toBeNull()
    expect(resolveUpdatesTouchIntent({ armed: true, ready: true, startY: 400, endY: 460 })).toBe(UPDATE_RETURN_INTENTS.RETURN)
    expect(resolveUpdatesTouchIntent({ armed: true, ready: true, startY: 460, endY: 400 })).toBe(UPDATE_RETURN_INTENTS.CANCEL)
  })
})
