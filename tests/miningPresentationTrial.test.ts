import { describe, it, expect } from 'vitest'
import { mainlineScenes, isMainlineStorefrontPresentationInRange, mainlineStorefrontApproach, mainlineStorefrontInteractionRegion } from '../src/center/runtime/mainlineScenes'

describe('isolated mining radius trial', () => {
  it('keeps radius five and navigation/click geometry while constraining the visual trigger to the true doorway', () => {
    for (const id of ['yonghe-mining-perimeter', 'yonghe-eatery'] as const) {
      const scene = mainlineScenes[id]
      for (const storefront of scene.storefronts) {
        const approach = mainlineStorefrontApproach(scene, storefront)
        const center = { x: approach.x - 6 + 2 * (28 / 1920 * 100), y: approach.y }
        expect(storefront.nearRadius).toBe(5)
        expect(isMainlineStorefrontPresentationInRange(scene, storefront, {x: approach.x - 6 + .1 * (28 / 1920 * 100), y: approach.y})).toBe(true)
        expect(storefront.presentationFrontage).toEqual({depthCells:2,halfSpanCells:2})
        expect(isMainlineStorefrontPresentationInRange(scene, storefront, { x: center.x, y: center.y + 2 })).toBe(true)
        expect(isMainlineStorefrontPresentationInRange(scene, storefront, { x: center.x, y: center.y + 2.1 * (28 / 1080 * 100) })).toBe(false)
        expect(mainlineStorefrontInteractionRegion(scene, storefront).radius).toBe(6)
      }
    }
    expect(mainlineScenes['commercial-street'].storefronts.every(slot => slot.nearRadius === 10)).toBe(true)
  })
  it('excludes the third-cell lane center and neighboring storefronts on both mining URLs', () => {
    for (const id of ['yonghe-mining-perimeter', 'yonghe-eatery'] as const) {
      const scene = mainlineScenes[id]
      const lane = scene.rooms.find(room => room.id === 'mining-street-public-lane')!
      for (const storefront of scene.storefronts) {
        const approach = mainlineStorefrontApproach(scene, storefront)
        const near = { x: approach.x - 6 + 2 * (28 / 1920 * 100), y: approach.y }
        expect(isMainlineStorefrontPresentationInRange(scene, storefront, { x: lane.bounds.x + lane.bounds.width / 2, y: approach.y })).toBe(false)
        expect(isMainlineStorefrontPresentationInRange(scene, storefront, near)).toBe(true)
        for (const other of scene.storefronts.filter(slot => slot !== storefront)) expect(isMainlineStorefrontPresentationInRange(scene, other, near)).toBe(false)
      }
    }
  })
})
