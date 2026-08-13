import { describe, expect, it } from 'vitest'
import {
  advanceUpdatesPhase,
  isUpdatesFlowActive,
  UPDATES_PHASE,
} from '../src/landing/landingUpdatesFlow'

describe('Landing updates flow', () => {
  it('has one direct transition for each page boundary', () => {
    expect(advanceUpdatesPhase(UPDATES_PHASE.LANDING, 'enter-requested'))
      .toBe(UPDATES_PHASE.ENTER_SURFACE)
    expect(advanceUpdatesPhase(UPDATES_PHASE.ENTER_SURFACE, 'surface-complete'))
      .toBe(UPDATES_PHASE.UPDATES)
    expect(advanceUpdatesPhase(UPDATES_PHASE.UPDATES, 'return-requested'))
      .toBe(UPDATES_PHASE.RETURN_SURFACE)
    expect(advanceUpdatesPhase(UPDATES_PHASE.RETURN_SURFACE, 'surface-complete'))
      .toBe(UPDATES_PHASE.LANDING)
  })

  it('ignores duplicate or out-of-order events instead of creating a second route', () => {
    expect(advanceUpdatesPhase(UPDATES_PHASE.LANDING, 'return-requested'))
      .toBe(UPDATES_PHASE.LANDING)
    expect(advanceUpdatesPhase(UPDATES_PHASE.UPDATES, 'enter-requested'))
      .toBe(UPDATES_PHASE.UPDATES)
    expect(advanceUpdatesPhase(UPDATES_PHASE.RETURN_SURFACE, 'return-requested'))
      .toBe(UPDATES_PHASE.RETURN_SURFACE)
  })

  it('reports only the page states as active', () => {
    expect(isUpdatesFlowActive(UPDATES_PHASE.LANDING)).toBe(false)
    expect(isUpdatesFlowActive(UPDATES_PHASE.ENTER_SURFACE)).toBe(true)
    expect(isUpdatesFlowActive(UPDATES_PHASE.UPDATES)).toBe(true)
    expect(isUpdatesFlowActive(UPDATES_PHASE.RETURN_SURFACE)).toBe(true)
  })
})
