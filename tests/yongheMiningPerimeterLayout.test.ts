import { describe, expect, it } from 'vitest'
import { createTwoSeatFurniture } from '../src/center/runtime/twoSeatFurniture'
import { mainlineSceneBlueprints } from '../src/center/runtime/mainlineSceneModel'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { yongheMiningPerimeterLayout as layout } from '../src/center/runtime/yongheMiningPerimeterLayout'

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

describe('Yonghe mining perimeter layout', () => {
  it('keeps eight compact storefront slots and the public lane within authored bounds', () => {
    expect(layout.storefronts.starts).toHaveLength(8)
    expect(layout.storefronts.labels).toHaveLength(8)
    expect(layout.storefronts.widths).toEqual([14, 28, 14, 14, 14, 14, 14, 14])
    expect(layout.areas.shopRow.x + layout.areas.shopRow.width).toBe(layout.areas.publicLane.x)
    expect(layout.areas.publicLane.x + layout.areas.publicLane.width).toBe(layout.areas.industrialEdge.x)
    expect(layout.areas.industrialEdge.x + layout.areas.industrialEdge.width).toBe(layout.walkBounds.x + layout.walkBounds.width)
    expect(layout.storefronts.starts).toEqual([6, 21, 50, 65, 80, 95, 110, 125])
    expect(layout.storefronts.starts.at(-1)! + layout.storefronts.widths.at(-1)!).toBeLessThan(layout.walkBounds.height)
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
    expect(eatery.portals[0].entity.displayLabel).toBe('门')
    expect(eatery.portals[1].entity.displayLabel).toBe('门')
    expect(eatery.portals[0].wallOpenings[0].opening.edge).toBe('right')
    expect(eatery.portals[1].wallOpenings[0].opening.edge).toBe('left')
    expect(layout.entry.roomBounds.width).toBe(28)
    expect(layout.entry.roomBounds.height).toBe(28)
    expect(layout.entry.counterBounds).toEqual({ x: 22.25, y: 26, width: 3.5, height: 22 })
    expect(layout.entry.servicePassageBounds).toEqual({ x: 22.25, y: 21, width: 3.5, height: 5 })
    expect(layout.entry.customerCounterApproach).toEqual({ x: 28.5, y: 36 })
  })

  it('builds the divider from repeated text and keeps customer, staff, menu, and locked-door approaches reachable on phone', () => {
    const eatery = mainlineScenes['yonghe-eatery']
    const counter = eatery.objects.find((entity) => entity.id === 'yonghe-counter')
    const counterSegments = eatery.objects.filter((entity) => entity.id === 'yonghe-counter' || entity.id.startsWith('yonghe-counter-segment-'))
    const structure = eatery.continuousStructures?.find(({ id }) => id === 'yonghe-counter-body')
    const metrics = { width: 390, height: 844, viewportWidth: 390 }
    const start = layout.entry.roomSafeEntryPosition
    const geometry = createMainlineSceneGeometrySnapshot(eatery, start, {}, metrics)
    const options = { screenMetrics: metrics, geometrySnapshot: geometry, actorFootprint: mainlineProtagonistDotFootprint(start, metrics) }
    const counterApproach = findMainlinePath(start, layout.entry.customerCounterApproach, eatery, {}, options)
    const menuApproach = findMainlinePathToEntity(eatery, 'yonghe-menu', start, {}, options)
    const tableApproaches = ['yonghe-upper-left-group-table', 'yonghe-lower-right-group-table']
      .map((entityId) => findMainlinePathToEntity(eatery, entityId, start, {}, options))
    const workAreaApproach = findMainlinePathToEntity(eatery, 'yonghe-stove', start, {}, options)
    const backDoorApproach = findMainlinePathToEntity(eatery, 'yonghe-back-door', start, {}, options)
    const staffOpeningCenter = {
      x: layout.entry.servicePassageBounds.x + layout.entry.servicePassageBounds.width / 2,
      y: layout.entry.servicePassageBounds.y + layout.entry.servicePassageBounds.height / 2,
    }

    expect(counter?.collision).toBeUndefined()
    expect(counter?.shape).toBeUndefined()
    expect(counter?.visualProfile).toBeUndefined()
    expect(counterSegments).toHaveLength(9)
    expect(counterSegments.every((segment) => segment.label === '柜台' && segment.interactionStructureId === 'yonghe-counter-body')).toBe(true)
    expect(structure).toMatchObject({ ...layout.entry.counterBounds, id: 'yonghe-counter-body', kind: 'counter' })
    expect(eatery.objects.filter((entity) => entity.id === 'yonghe-survey-central-lane')).toHaveLength(0)
    expect(eatery.objects.filter((entity) => entity.id === 'yonghe-menu' && entity.surface === 'wall')).toHaveLength(1)
    expect(eatery.objects.filter((entity) => entity.kind === 'table')).toHaveLength(2)
    expect(eatery.objects.filter((entity) => entity.kind === 'seat')).toHaveLength(4)
    expect(overlaps(layout.entry.counterBounds, layout.entry.servicePassageBounds)).toBe(false)
    expect(layout.entry.servicePassageBounds.height).toBeGreaterThanOrEqual(3.2)
    expect(layout.entry.counterBounds.y + layout.entry.counterBounds.height).toBeGreaterThan(47)
    expect(isWalkableMainlinePoint(start, eatery, {}, options)).toBe(true)
    expect(isWalkableMainlinePoint(staffOpeningCenter, eatery, {}, options)).toBe(true)
    expect(findMainlinePath(start, staffOpeningCenter, eatery, {}, options)).not.toBeNull()
    expect(counterApproach).not.toBeNull()
    expect(menuApproach.path).not.toBeNull()
    expect(tableApproaches.every(({ path }) => path !== null)).toBe(true)
    expect(workAreaApproach.path).not.toBeNull()
    expect(backDoorApproach.path).not.toBeNull()
    expect(findMainlinePath(start, layout.entry.customerCentralLane, eatery, {}, options)).not.toBeNull()
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
        seatGap: 3.2,
        pulledSeatGap: 4.2,
        sitSeatGap: 4.2,
      })
      expect(overlaps(corridor, geometry.bounds), `${furniture.groupId} intersects door corridor`).toBe(false)
    }
  })

  it('keeps the outdoor furniture outside neighbour bays and aligns rear markers to storefronts', () => {
    const firstEateryBay = { start: layout.storefronts.starts[layout.storefronts.eateryIndex], width: layout.storefronts.widths[layout.storefronts.eateryIndex] }
    for (const furniture of layout.outdoorFurniture) {
      expect(furniture.anchor.x).toBeGreaterThan(layout.areas.shopRow.x + layout.areas.shopRow.width)
      expect(furniture.anchor.y).toBeGreaterThan(firstEateryBay.start)
      expect(furniture.anchor.y).toBeLessThan(firstEateryBay.start + firstEateryBay.width)
      expect(furniture.approach.x).toBeLessThan(layout.areas.industrialEdge.x)
    }
    expect(layout.shopRow.rearDoorPositions).toHaveLength(8)
    expect(layout.shopRow.rearDoorPositions[layout.storefronts.eateryIndex]).toBe(layout.entry.rearDoorPosition.y)
  })
})
