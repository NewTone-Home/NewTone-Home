import { describe, expect, it } from 'vitest'
import {
  commercialCafeFinishDeliveryLine, commercialCafeFinishDeliveryReturn,
  commercialCafeStoryStateFromSceneState, commercialCafeStoryStatePatch,
  type CommercialCafeStoryState,
} from './commercialCafeStory'

describe('Cafe story delivery return gate', () => {
  it('persists the return phase after the delivery line and exposes line three only after arrival', () => {
    const delivered: CommercialCafeStoryState = {
      status: 'available', narrativeCursor: 1, coffeeStatus: 'delivered',
      coffeePreparationStartedAt: null, narrativePhase: 'coffee-delivery',
      laoZhouDeparture: 'seated', completedAt: null,
    }
    const clicked = commercialCafeFinishDeliveryLine(delivered)
    expect(clicked).toMatchObject({ narrativeCursor: 1, narrativePhase: 'coffee-returning' })
    const restored = commercialCafeStoryStateFromSceneState(commercialCafeStoryStatePatch(clicked))
    expect(restored).toMatchObject({ narrativeCursor: 1, narrativePhase: 'coffee-returning', coffeeStatus: 'delivered' })
    const arrivedBack = commercialCafeFinishDeliveryReturn(restored)
    expect(arrivedBack).toMatchObject({ narrativeCursor: 2, narrativePhase: 'dialogue' })
    expect(commercialCafeFinishDeliveryReturn(arrivedBack)).toBe(arrivedBack)
  })
})
