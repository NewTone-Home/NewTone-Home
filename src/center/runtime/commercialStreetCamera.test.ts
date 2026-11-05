import { describe, expect, it } from 'vitest'
import { commercialStreetCameraPages, commercialStreetPageIndex, usesCommercialStreetPages } from './commercialStreetCamera'
import { mainlineScenes, mainlineStorefrontApproach } from './mainlineScenes'
import { mainlineCameraOffset, mainlineViewportPointFromWorld } from './mainlineViewport'

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
  it('switches between public pages and interior follow on entry and exit', () => {
    const approach = mainlineStorefrontApproach(street, street.storefronts[0]!)
    const room = street.rooms.find(room => room.id.endsWith('-interior'))!
    const inside = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
    expect([approach, inside, approach, inside].map(position => usesCommercialStreetPages(street, position)))
      .toEqual([true, false, true, false])
    expect(usesCommercialStreetPages(mainlineScenes['zhongshuyuan-office'], { x: 50, y: 50 })).toBe(false)
  })

  it('uses the same outdoor pages for the mine and anchors its vertical view to the player', () => {
    const mine = mainlineScenes['yonghe-mining-perimeter']
    const alley = mine.rooms.find(room => room.id === 'mining-street-back-alley')!
    const lane = mine.rooms.find(room => room.id === 'mining-street-public-lane')!
    const shop = mine.rooms.find(room => room.id === 'mining-shop-2-interior')!
    const alleyPosition = { x: alley.bounds.x + alley.bounds.width / 2, y: alley.bounds.y + alley.bounds.height / 2 }
    const shopPosition = { x: shop.bounds.x + shop.bounds.width / 2, y: shop.bounds.y + shop.bounds.height / 2 }
    expect(usesCommercialStreetPages(mine, alleyPosition)).toBe(true)
    expect(usesCommercialStreetPages(mine, { x: alleyPosition.x, y: lane.bounds.y + 2 })).toBe(true)
    expect(usesCommercialStreetPages(mine, shopPosition)).toBe(false)

    const frameTopY = Math.min(...mine.geometry
      .filter(unit => unit.sourceWallId === 'mining-street-back-alley-frame' && unit.edge === 'top')
      .flatMap(unit => unit.visual.cells.map(cell => cell.y)))
    const yongheDoor = mine.geometry.find(unit => unit.sourceWallId === 'mining-shop-2-interior-shell'
      && unit.edge === 'top' && unit.navigation.passageId === 'yonghe-back-door' && unit.surface === 'door')!
    const doorY = yongheDoor.visual.cells[0]!.y

    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      const pages = commercialStreetCameraPages(mine, viewport, alleyPosition.y)
      expect(pages.centers.length).toBeGreaterThan(1)
      for (let index = 1; index < pages.centers.length; index++) {
        expect(pages.centers[index]! - pages.centers[index - 1]!).toBeLessThanOrEqual(pages.span * .8 + .00001)
      }
      const camera = { x: 50 - pages.centers[0]!, y: pages.yOffset }
      for (const y of [frameTopY, doorY]) {
        const point = mainlineViewportPointFromWorld({ x: 50, y }, viewport, camera)
        expect(point.y, `alley boundary or back door must fit at ${viewport.width}x${viewport.height}`).toBeGreaterThan(0)
        expect(point.y).toBeLessThan(100)
      }
    }
  })
})
