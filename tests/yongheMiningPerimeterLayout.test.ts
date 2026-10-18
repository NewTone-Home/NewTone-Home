import { describe, expect, it } from 'vitest'
import { createTwoSeatFurniture } from '../src/center/runtime/twoSeatFurniture'
import { mainlineSceneBlueprints } from '../src/center/runtime/mainlineSceneModel'
import { yongheMiningPerimeterLayout as layout } from '../src/center/runtime/yongheMiningPerimeterLayout'

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

describe('Yonghe mining perimeter layout', () => {
  it('keeps the existing eight storefront slots and public lane within the authored bounds', () => {
    expect(layout.storefronts.starts).toHaveLength(8)
    expect(layout.storefronts.labels).toHaveLength(8)
    expect(layout.storefronts.width).toBe(18)
    expect(layout.areas.shopRow.x + layout.areas.shopRow.width).toBe(layout.areas.publicLane.x)
    expect(layout.areas.publicLane.x + layout.areas.publicLane.width).toBe(layout.areas.industrialEdge.x)
    expect(layout.areas.industrialEdge.x + layout.areas.industrialEdge.width).toBe(layout.walkBounds.x + layout.walkBounds.width)
    expect(layout.storefronts.starts).toEqual([10, 32, 54, 76, 98, 120, 142, 164])
  })

  it('keeps the existing eatery door as the only open storefront and preserves both passage landings', () => {
    const street = mainlineSceneBlueprints['yonghe-mining-perimeter']
    const eatery = mainlineSceneBlueprints['yonghe-eatery']
    const doorSlots = street.scene.storefronts?.filter((slot) => slot.portalId) ?? []

    expect(street.scene.storefronts).toHaveLength(8)
    expect(doorSlots.map((slot) => slot.portalId)).toEqual(['yonghe-street-entry'])
    expect(street.portals.map((portal) => portal.id)).toEqual(['yonghe-street-entry'])
    expect(street.portals[0].endpoint).toMatchObject({
      doorPosition: layout.entry.doorPosition,
      threshold: layout.entry.threshold,
      crossingTarget: layout.entry.crossingTarget,
      entryPosition: layout.entry.eateryEntryPosition,
    })
    expect(eatery.portals[0].endpoint.entryPosition).toEqual(layout.entry.streetEntryPosition)
    expect(eatery.portals[1].access).toBe('locked')
  })

  it('leaves a clear collision corridor around the street-side door landing', () => {
    const corridor = layout.entry.approachClearance

    for (const furniture of layout.outdoorFurniture) {
      const geometry = createTwoSeatFurniture({
        groupId: furniture.groupId,
        tableId: furniture.tableId,
        seatIds: furniture.seatIds,
        anchor: furniture.anchor,
        tableApproach: furniture.approach,
      })
      expect(overlaps(corridor, geometry.bounds), `${furniture.groupId} intersects door corridor`).toBe(false)
    }
  })
})
