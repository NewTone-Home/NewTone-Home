import { describe, it, expect } from 'vitest'
import { mainlineScenes, isMainlineStorefrontPresentationInRange, mainlineStorefrontApproach, mainlineStorefrontInteractionRegion } from '../src/center/runtime/mainlineScenes'

describe('mining doorway reveal stays at the real entrance', () => {
  it('reveals at the six-unit approach while the frontage gate stops short of the lane centre', () => {
    for (const id of ['yonghe-mining-perimeter', 'yonghe-eatery'] as const) {
      const scene = mainlineScenes[id]
      const lane = scene.rooms.find(room => room.id === 'mining-street-public-lane')!
      for (const storefront of scene.storefronts) {
        const approach = mainlineStorefrontApproach(scene, storefront)
        expect(storefront.edge).toBe('bottom')
        expect(storefront.nearRadius).toBeCloseTo(6.1, 5)
        expect(storefront.presentationFrontage).toEqual({ depthCells: 2.5, halfSpanCells: 2 })
        expect(isMainlineStorefrontPresentationInRange(scene, storefront, approach)).toBe(true)
        expect(mainlineStorefrontInteractionRegion(scene, storefront).radius).toBe(6)
        const laneCenter = { x: approach.x, y: lane.bounds.y + lane.bounds.height / 2 }
        expect(isMainlineStorefrontPresentationInRange(scene, storefront, laneCenter)).toBe(false)
        for (const other of scene.storefronts.filter(slot => slot !== storefront)) {
          expect(isMainlineStorefrontPresentationInRange(scene, other, approach)).toBe(false)
        }
      }
    }
  })
})
