import { describe, expect, it } from 'vitest'
import { mainlineNpcStagedSeatId } from '../src/center/runtime/mainlineNpcStaging'
import { findMainlinePathToEntity } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineSceneOccupiedSeatIds } from '../src/center/runtime/mainlineSeating'
import { currentCafeStart } from './helpers/currentCafe'
import {
  defaultLaoZhouCafeSeatId,
  isLaoZhouCafeSeatId,
  laoZhouCafeConversationSeatId,
  laoZhouCafeSeatPairs,
  selectLaoZhouCafeSeat,
  withLaoZhouCafeSeat,
} from '../src/center/runtime/commercialCafeSeatSelection'
import { commercialCafeSeatGuideDialogue, initialCommercialCafeStoryState, resolveCommercialCafeNpcInteraction } from '../src/center/runtime/commercialCafeStory'

describe('Lao Zhou Cafe seat selection', () => {
  it('offers each authored two-seat table without inventing IDs and selects deterministically from the supplied draw', () => {
    const candidates = laoZhouCafeSeatPairs().flatMap((pair) => pair.map((seat) => seat.id))
    expect(laoZhouCafeSeatPairs()).toHaveLength(6)
    expect(candidates).toHaveLength(12)
    expect(new Set(candidates).size).toBe(12)
    expect(candidates.every(isLaoZhouCafeSeatId)).toBe(true)
    expect(selectLaoZhouCafeSeat(() => 0)).toBe(candidates[0])
    expect(selectLaoZhouCafeSeat(() => 0.5)).toBe(candidates[6])
    expect(selectLaoZhouCafeSeat(() => 0.999999)).toBe(candidates[11])
    expect(selectLaoZhouCafeSeat(() => Number.NaN)).toBe(candidates[0])
  })

  it('uses the same selected chair for NPC staging, occupancy, reachable paired seat, and the story gate', () => {
    const base = mainlineScenes['commercial-street']
    const story = initialCommercialCafeStoryState()
    for (const pair of laoZhouCafeSeatPairs()) {
      for (const laoZhouSeat of pair) {
        const conversationSeatId = pair.find((seat) => seat.id !== laoZhouSeat.id)!.id
        const scene = withLaoZhouCafeSeat(base, laoZhouSeat.id)
        expect(mainlineNpcStagedSeatId(scene, 'lao-zhou')).toBe(laoZhouSeat.id)
        expect(mainlineSceneOccupiedSeatIds(scene)).toEqual(new Set([laoZhouSeat.id]))
        expect(mainlineSceneOccupiedSeatIds(scene).has(conversationSeatId)).toBe(false)
        expect(findMainlinePathToEntity(scene, conversationSeatId, currentCafeStart).path).not.toBeNull()
        expect(laoZhouCafeConversationSeatId(laoZhouSeat.id)).toBe(conversationSeatId)
        expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-street', npcId: 'lao-zhou', story, playerSeatId: conversationSeatId, conversationSeatId })).toEqual({ kind: 'start-narrative' })
        expect(resolveCommercialCafeNpcInteraction({ sceneId: 'commercial-street', npcId: 'lao-zhou', story, playerSeatId: laoZhouSeat.id, conversationSeatId })).toEqual({ kind: 'dialogue', dialogue: commercialCafeSeatGuideDialogue })
      }
    }
  })

  it('falls back to the authored seat for a missing or invalid stored ID', () => {
    expect(defaultLaoZhouCafeSeatId).toBe('commercial-cafe-right-window-upper-group-chair-top')
    expect(isLaoZhouCafeSeatId('not-a-cafe-chair')).toBe(false)
    expect(mainlineNpcStagedSeatId(withLaoZhouCafeSeat(mainlineScenes['commercial-cafe'], 'not-a-cafe-chair'), 'lao-zhou')).toBe(defaultLaoZhouCafeSeatId)
  })
})
