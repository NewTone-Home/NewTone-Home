import { describe, it, expect } from 'vitest'
import { mainlineScenes, isMainlineStorefrontPresentationInRange, mainlineStorefrontApproach, mainlineStorefrontInteractionRegion } from '../src/center/runtime/mainlineScenes'

describe('isolated mining radius trial', () => {
  it('halves only the mining visual tolerance while preserving its center and interaction radius', () => {
    for (const id of ['yonghe-mining-perimeter', 'yonghe-eatery'] as const) {
      const scene = mainlineScenes[id]
      for (const storefront of scene.storefronts) {
        const center = mainlineStorefrontApproach(scene, storefront)
        expect(storefront.nearRadius).toBe(5)
        expect(isMainlineStorefrontPresentationInRange(scene, storefront, { x: center.x, y: center.y + 4.9 })).toBe(true)
        expect(isMainlineStorefrontPresentationInRange(scene, storefront, { x: center.x, y: center.y + 5.1 })).toBe(false)
        expect(mainlineStorefrontInteractionRegion(scene, storefront).radius).toBe(6)
      }
    }
    expect(mainlineScenes['commercial-street'].storefronts.every(slot => slot.nearRadius === 10)).toBe(true)
  })
  it('records the remaining centerline overlap instead of mistaking half radius for a complete trigger fix', () => {
    const scene = mainlineScenes['yonghe-mining-perimeter']
    const lane = scene.rooms.find(room => room.id === 'mining-street-public-lane')!
    const storefront = scene.storefronts[1]!
    const center = mainlineStorefrontApproach(scene, storefront)
    expect(isMainlineStorefrontPresentationInRange(scene, storefront, { x: lane.bounds.x + lane.bounds.width / 2, y: center.y })).toBe(true)
  })
})
