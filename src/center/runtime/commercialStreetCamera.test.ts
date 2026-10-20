import { describe, expect, it } from 'vitest'
import { commercialStreetCameraPages, commercialStreetPageIndex, usesCommercialStreetPages } from './commercialStreetCamera'
import { mainlineScenes, mainlineStorefrontApproach } from './mainlineScenes'
import { mainlineCameraOffset } from './mainlineViewport'

const street = mainlineScenes['commercial-street']
describe('commercial street camera pages', () => {
  it.each([{ width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }])('keeps both outer margins and overlapping pages at $width', (viewport) => {
    const { centers, span } = commercialStreetCameraPages(street, viewport)
    const bounds = street.walkBounds
    expect(centers[0]).toBeCloseTo(50 - mainlineCameraOffset(street, { x: bounds.x, y: 50 }, false, viewport).x)
    expect(centers.at(-1)).toBeCloseTo(50 - mainlineCameraOffset(street, { x: bounds.x + bounds.width, y: 50 }, false, viewport).x)
    for (let i = 1; i < centers.length; i++) {
      expect(centers[i]! - centers[i - 1]!).toBeGreaterThan(0)
      expect(centers[i]! - centers[i - 1]!).toBeLessThanOrEqual(span * .8 + .00001)
    }
    let page = 0
    for (let x = bounds.x; x <= bounds.x + bounds.width; x += .1) {
      const next = commercialStreetPageIndex(centers, x, span, page)
      expect(next).toBeGreaterThanOrEqual(page)
      expect(commercialStreetPageIndex(centers, x, span, next)).toBe(next)
      page = next
    }
    expect(page).toBe(centers.length - 1)
    for (let x = bounds.x + bounds.width; x >= bounds.x; x -= .1) {
      const next = commercialStreetPageIndex(centers, x, span, page)
      expect(next).toBeLessThanOrEqual(page)
      page = next
    }
    expect(page).toBe(0)
  })
  it('holds a page through its middle and selects a nearby page for restored positions', () => {
    const { centers, span } = commercialStreetCameraPages(street, { width: 390, height: 844 })
    centers.forEach((x, index) => {
      expect(commercialStreetPageIndex(centers, x, span)).toBe(index)
      expect(commercialStreetPageIndex(centers, x + span * .3, span, index)).toBe(index)
      expect(commercialStreetPageIndex(centers, x - span * .3, span, index)).toBe(index)
    })
  })
  it('leaves storefront interiors and other scenes on their existing camera policy', () => {
    expect(usesCommercialStreetPages(street, mainlineStorefrontApproach(street, street.storefronts[0]!))).toBe(true)
    const room = street.rooms.find(room => room.id.endsWith('-interior'))!
    expect(usesCommercialStreetPages(street, { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 })).toBe(false)
    expect(usesCommercialStreetPages(mainlineScenes['zhongshuyuan-office'], { x: 50, y: 50 })).toBe(false)
  })
})
