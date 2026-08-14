import { describe, expect, it } from 'vitest'
import { advanceUpdatesPhase, UPDATES_PHASE } from '../src/landing/landingUpdatesFlow'

describe('Landing updates flow', () => {
  it('enters the Updates surface directly after the entry intent', () => {
    expect(advanceUpdatesPhase(UPDATES_PHASE.LANDING, 'enter-requested')).toBe(UPDATES_PHASE.ENTER_SURFACE)
    expect(advanceUpdatesPhase(UPDATES_PHASE.ENTER_SURFACE, 'surface-complete')).toBe(UPDATES_PHASE.UPDATES)
  })

  it('returns directly to Landing after the Updates surface leaves', () => {
    expect(advanceUpdatesPhase(UPDATES_PHASE.UPDATES, 'return-requested')).toBe(UPDATES_PHASE.RETURN_SURFACE)
    expect(advanceUpdatesPhase(UPDATES_PHASE.RETURN_SURFACE, 'surface-complete')).toBe(UPDATES_PHASE.LANDING)
  })

  it('ignores duplicate events outside the owning phase', () => {
    expect(advanceUpdatesPhase(UPDATES_PHASE.LANDING, 'surface-complete')).toBe(UPDATES_PHASE.LANDING)
    expect(advanceUpdatesPhase(UPDATES_PHASE.UPDATES, 'return-requested')).toBe(UPDATES_PHASE.RETURN_SURFACE)
    expect(advanceUpdatesPhase(UPDATES_PHASE.RETURN_SURFACE, 'return-requested')).toBe(UPDATES_PHASE.RETURN_SURFACE)
  })
})
