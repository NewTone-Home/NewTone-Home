import { describe, expect, it } from 'vitest'
import {
  WORLD_ENTRY_INITIAL_STATE,
  WORLD_ENTRY_PHASE,
  worldEntryReducer,
} from './worldEntryTransition'

describe('世界入口转场状态机', () => {
  it('waits for both the cover and the first scene layout before revealing', () => {
    const started = worldEntryReducer(WORLD_ENTRY_INITIAL_STATE, { type: 'start' })
    const sceneReady = worldEntryReducer(started, { type: 'scene-ready' })
    const covered = worldEntryReducer(sceneReady, { type: 'cover-complete' })

    expect(sceneReady.phase).toBe(WORLD_ENTRY_PHASE.COVERING)
    expect(covered.phase).toBe(WORLD_ENTRY_PHASE.REVEALING)
  })

  it('does not reveal before the Center background has covered Landing', () => {
    const started = worldEntryReducer(WORLD_ENTRY_INITIAL_STATE, { type: 'start' })
    const covered = worldEntryReducer(started, { type: 'cover-complete' })
    const ready = worldEntryReducer(covered, { type: 'scene-ready' })

    expect(covered.phase).toBe(WORLD_ENTRY_PHASE.COVERED)
    expect(ready.phase).toBe(WORLD_ENTRY_PHASE.REVEALING)
  })

  it('becomes active only after the scene reveal finishes', () => {
    const started = worldEntryReducer(WORLD_ENTRY_INITIAL_STATE, { type: 'start' })
    const ready = worldEntryReducer(started, { type: 'scene-ready' })
    const revealing = worldEntryReducer(ready, { type: 'cover-complete' })
    const active = worldEntryReducer(revealing, { type: 'reveal-complete' })

    expect(active.phase).toBe(WORLD_ENTRY_PHASE.ACTIVE)
  })
})
