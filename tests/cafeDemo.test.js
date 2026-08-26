import { describe, expect, it } from 'vitest'
import { resolveSceneInteraction, INTERACTION_TYPES } from '../src/center/sceneRuntime/interactionResolver'
import { getMovementDuration } from '../src/center/sceneRuntime/useSceneMovement'
import { CAFE_SCENE } from '../src/center/cafeDemo/cafeScene'
import {
  advanceCafeDialogue,
  applyCafeEvent,
  createInitialCafeNarrative,
  getCurrentCafeDialogue,
  CAFE_STORY_STATES,
} from '../src/center/cafeDemo/cafeNarrative'

describe('Center cafe playable scene', () => {
  it('keeps the story gate in order while allowing environmental movement', () => {
    let state = createInitialCafeNarrative()

    expect(resolveSceneInteraction({ scene: CAFE_SCENE, objectId: 'lao-zhou', narrativeState: state }).type).toBe(INTERACTION_TYPES.FEEDBACK)
    expect(resolveSceneInteraction({ scene: CAFE_SCENE, objectId: 'door', narrativeState: state })).toMatchObject({ type: INTERACTION_TYPES.STORY, event: 'enter-cafe' })

    state = applyCafeEvent(state, 'enter-cafe')
    expect(state.stage).toBe(CAFE_STORY_STATES.ENTERED)
    expect(resolveSceneInteraction({ scene: CAFE_SCENE, objectId: 'chair', narrativeState: state }).type).toBe(INTERACTION_TYPES.FEEDBACK)
    expect(resolveSceneInteraction({ scene: CAFE_SCENE, objectId: 'counter', narrativeState: state })).toMatchObject({ event: 'order-coffee' })

    state = applyCafeEvent(state, 'order-coffee')
    expect(resolveSceneInteraction({ scene: CAFE_SCENE, objectId: 'lao-zhou', narrativeState: state })).toMatchObject({ event: 'meet-lao-zhou' })
  })

  it('renders the published cafe dialogue through the complete selected fragment', () => {
    let state = createInitialCafeNarrative()
    ;['enter-cafe', 'order-coffee', 'meet-lao-zhou'].forEach(event => { state = applyCafeEvent(state, event) })
    expect(getCurrentCafeDialogue(state)).toEqual({ speaker: '修杰', text: '老周，陈副部长还是没有消息吗？' })

    state = advanceCafeDialogue(state)
    expect(getCurrentCafeDialogue(state)).toEqual({ speaker: '老周', text: '完全没有。' })
    state = advanceCafeDialogue(state)
    expect(state.stage).toBe(CAFE_STORY_STATES.COFFEE_DELIVERED)

    state = applyCafeEvent(state, 'sip-coffee')
    state = advanceCafeDialogue(state)
    state = advanceCafeDialogue(state)
    expect(state.stage).toBe(CAFE_STORY_STATES.INTEL_CONVERSATION)
    expect(getCurrentCafeDialogue(state).text).toContain('我昨天无意间看到了一份文档')
  })

  it('keeps movement short enough to establish continuity without becoming a walk simulator', () => {
    expect(getMovementDuration({ x: 12, y: 58 }, { x: 76, y: 42 })).toBeLessThanOrEqual(520)
    expect(getMovementDuration({ x: 12, y: 58 }, { x: 14, y: 55 })).toBeGreaterThanOrEqual(180)
  })
})
