import { describe, expect, it } from 'vitest'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { canTravelAlongMainlineSegment, findMainlinePath, findMainlinePathToEntity, isMainlineNavigationBarrierClear, isWalkableMainlinePoint, mainlineEntityInteractionCandidates, mainlineNavigationBarriers, resolveMainlineWorldNavigation } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityTextFootprint } from '../src/center/runtime/sceneLayout'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { createFreeRoamController, prepareMovementPath } from '../src/center/runtime/useFreeRoamMovement'

describe('navigation barrier segments', () => {
  const cafe = mainlineScenes['commercial-cafe']
  const pilotTableId = 'commercial-cafe-right-window-upper-group-table'
  const pilotTopChairId = 'commercial-cafe-right-window-upper-group-chair-top'
  const pilotBottomChairId = 'commercial-cafe-right-window-upper-group-chair-bottom'
  const dot = mainlineProtagonistDotFootprint(cafe.initialPlayerPosition)
  const protagonistOptions = { actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height } }

  function pilotGeometry() {
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
    const table = snapshot.objects.get(pilotTableId)!
    const topChair = snapshot.objects.get(pilotTopChairId)!
    const bottomChair = snapshot.objects.get(pilotBottomChairId)!
    const barriers = mainlineNavigationBarriers(cafe)
    return { snapshot, table, topChair, bottomChair, barriers }
  }

  function movementOptions(scene: typeof cafe, options = protagonistOptions) {
    return {
      canOccupy: (point: { x: number; y: number }) => isWalkableMainlinePoint(point, scene, {}, options),
      canTraverse: (start: { x: number; y: number }, end: { x: number; y: number }) => isMainlineNavigationBarrierClear(start, end, scene, {}, options),
    }
  }

  function expectPreparedRouteToBeLiveLegal(
    scene: typeof cafe,
    start: { x: number; y: number },
    path: { x: number; y: number }[],
  ) {
    const prepared = prepareMovementPath(path, start, movementOptions(scene))
    let previous = start
    for (const waypoint of prepared.waypoints) {
      expect(canTravelAlongMainlineSegment(previous, waypoint, scene, {}, protagonistOptions)).toBe(true)
      previous = waypoint
    }
    return prepared
  }

  it('derives non-occupying crossing barriers from every cafe table-chair relationship', () => {
    const { table, topChair, bottomChair, barriers } = pilotGeometry()
    const topBarrier = barriers.find((barrier) => barrier.id === 'commercial-cafe-right-window-upper-group-chair-top-table-barrier')!
    const bottomBarrier = barriers.find((barrier) => barrier.id === 'commercial-cafe-right-window-upper-group-chair-bottom-table-barrier')!

    expect(barriers.filter((barrier) => barrier.kind !== 'access-boundary')).toHaveLength(22)
    for (const [chair, barrier] of [[topChair, topBarrier], [bottomChair, bottomBarrier] as const]) {
      const gapCenter = { x: table.position.x, y: (chair.collision!.y + chair.collision!.height + table.collision!.y) / 2 }
      expect(isWalkableMainlinePoint(gapCenter, cafe, {}, protagonistOptions)).toBe(true)
      expect(barrier.start.x).toBe(barrier.end.x)
      expect(barrier.start.x).toBeGreaterThanOrEqual(table.collision!.x)
      expect(barrier.end.x).toBeLessThanOrEqual(table.collision!.x + table.collision!.width)
    }
  })

  it('blocks direct table-chair crossings for both protagonists and NPCs, while a shared route detours around the barrier', () => {
    const { table, topChair, barriers } = pilotGeometry()
    const barrier = barriers.find((candidate) => candidate.id === 'commercial-cafe-right-window-upper-group-chair-top-table-barrier')!
    const gapY = (barrier.start.y + barrier.end.y) / 2
    const topGapSide = { x: barrier.start.x - dot.width, y: gapY }
    const tableGapSide = { x: barrier.start.x + dot.width, y: gapY }

    expect(isWalkableMainlinePoint(topGapSide, cafe, {}, protagonistOptions)).toBe(true)
    expect(isWalkableMainlinePoint(tableGapSide, cafe, {}, protagonistOptions)).toBe(true)
    expect(isMainlineNavigationBarrierClear(topGapSide, tableGapSide, cafe, {}, protagonistOptions)).toBe(false)
    expect(isMainlineNavigationBarrierClear(topGapSide, tableGapSide, cafe, {}, { actorId: 'server' })).toBe(false)

    const route = findMainlinePath(topGapSide, tableGapSide, cafe, {}, protagonistOptions)
    const worldCommand = resolveMainlineWorldNavigation(cafe, topGapSide, tableGapSide, {}, protagonistOptions)
    expect(worldCommand?.resolvedNavigableTarget).toEqual(tableGapSide)
    expect(route).not.toBeNull()
    expect(route!.length).toBeGreaterThan(2)
    expect(route!.every((point) => isWalkableMainlinePoint(point, cafe, {}, protagonistOptions))).toBe(true)
    for (let index = 1; index < route!.length; index += 1) {
      expect(isMainlineNavigationBarrierClear(route![index - 1]!, route![index]!, cafe, {}, protagonistOptions)).toBe(true)
    }

    const blockedController = createFreeRoamController(topGapSide)
    let blocked = false
    blockedController.moveAlong([tableGapSide], undefined, {
      maxSpeed: 100,
      canOccupy: (point) => isWalkableMainlinePoint(point, cafe, {}, protagonistOptions),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, cafe, {}, protagonistOptions),
      onBlocked: () => { blocked = true },
    })
    blockedController.tick(100)
    expect(blocked).toBe(true)
  })

  it('keeps four chair edge contacts and lets route legality choose an accessible side instead of a seat-side rule', () => {
    const { table } = pilotGeometry()
    const candidates = mainlineEntityInteractionCandidates(cafe, pilotBottomChairId, cafe.initialPlayerPosition, {}, protagonistOptions.actorFootprint, protagonistOptions)
    const leftContact = candidates.reduce((leftmost, candidate) => candidate.x < leftmost.x ? candidate : leftmost)
    const rightContact = candidates.reduce((rightmost, candidate) => candidate.x > rightmost.x ? candidate : rightmost)
    const fromLeft = { x: leftContact.x - dot.width, y: leftContact.y }
    const fromRight = { x: rightContact.x + dot.width, y: rightContact.y }

    expect(new Set(candidates.map((candidate) => `${candidate.x.toFixed(4)},${candidate.y.toFixed(4)}`)).size).toBe(4)
    expect(isWalkableMainlinePoint(fromLeft, cafe, {}, protagonistOptions)).toBe(true)
    expect(isWalkableMainlinePoint(fromRight, cafe, {}, protagonistOptions)).toBe(true)
    expect(findMainlinePathToEntity(cafe, pilotBottomChairId, fromLeft, {}, protagonistOptions).path).not.toBeNull()
    expect(findMainlinePathToEntity(cafe, pilotBottomChairId, fromRight, {}, protagonistOptions).path).not.toBeNull()

    const tableLeft = findMainlinePathToEntity(cafe, pilotTableId, { x: table.collision!.x - dot.width, y: table.position.y }, {}, protagonistOptions)
    const tableRight = findMainlinePathToEntity(cafe, pilotTableId, { x: table.collision!.x + table.collision!.width + dot.width, y: table.position.y }, {}, protagonistOptions)
    expect(tableLeft.path).not.toBeNull()
    expect(tableRight.path).not.toBeNull()
  })

  it('migrates every two-seat group and every four-seat group through the same relation contract', () => {
    const twoSeatGroups = [
      'commercial-cafe-right-inner-upper-group',
      'commercial-cafe-right-inner-middle-group',
      'commercial-cafe-right-inner-lower-group',
      'commercial-cafe-right-window-upper-group',
      'commercial-cafe-right-window-lower-group',
    ]
    const fourSeatGroups = [
      'commercial-cafe-bottom-left-group',
      'commercial-cafe-bottom-center-group',
      'commercial-cafe-bottom-right-group',
    ]
    const barriers = mainlineNavigationBarriers(cafe)

    for (const groupId of twoSeatGroups) {
      expect(barriers.filter((barrier) => barrier.id.startsWith(`${groupId}-`))).toHaveLength(2)
    }
    for (const groupId of fourSeatGroups) {
      const table = cafe.objects.find((entity) => entity.id === `${groupId}-table`)!
      const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
      expect(table.movementCollision).not.toBe('physical')
      expect(table.interactionContactSides).toBeUndefined()
      expect(snapshot.objects.get(table.id)!.collision).toEqual(mainlineEntityTextFootprint(table, snapshot.objects.get(table.id)!.position))
      expect(snapshot.objects.get(table.id)!.collision!.height).toBeLessThan(3)
      expect(barriers.filter((barrier) => barrier.id.startsWith(`${groupId}-`))).toHaveLength(4)
      for (const chair of cafe.objects.filter((entity) => entity.groupId === groupId && entity.kind === 'seat')) {
        expect(chair.movementCollision).not.toBe('physical')
        expect(snapshot.objects.get(chair.id)!.collision).toEqual(mainlineEntityTextFootprint(chair, snapshot.objects.get(chair.id)!.position))
      }
    }
  })

  it('uses the same non-occupying relation barriers for the office workstation and ancestral altar', () => {
    const office = mainlineScenes['zhongshuyuan-office']
    const shrine = mainlineScenes['jijia-ancestral-interior']
    const officeBarriers = mainlineNavigationBarriers(office)
    const altarBarriers = mainlineNavigationBarriers(shrine)
    const shrineSnapshot = createMainlineSceneGeometrySnapshot(shrine, shrine.initialPlayerPosition)

    expect(officeBarriers).toHaveLength(1)
    expect(officeBarriers[0]!.id).toBe('zhongshuyuan-office-workstation-chair-desk-barrier')
    expect(altarBarriers).toHaveLength(4)
    for (const barrier of altarBarriers) {
      expect(barrier.start).not.toEqual(barrier.end)
    }
    for (const entity of shrine.objects.filter((entity) => entity.label === '供桌' || entity.label === '香炉')) {
      expect(shrineSnapshot.objects.get(entity.id)!.collision).toEqual(mainlineEntityTextFootprint(entity, shrineSnapshot.objects.get(entity.id)!.position))
    }
  })

  it('never turns an altar interaction detour into a relation-barrier crossing during movement preparation', () => {
    const shrine = mainlineScenes['jijia-ancestral-interior']
    const shrineDot = mainlineProtagonistDotFootprint(shrine.initialPlayerPosition)
    const shrineOptions = { actorId: 'protagonist', actorFootprint: { width: shrineDot.width, height: shrineDot.height } }
    const route = findMainlinePathToEntity(shrine, 'jijia-incense-burner', shrine.initialPlayerPosition, {}, shrineOptions).path

    expect(route).not.toBeNull()
    const prepared = prepareMovementPath(route!, shrine.initialPlayerPosition, {
      canOccupy: (point) => isWalkableMainlinePoint(point, shrine, {}, shrineOptions),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, shrine, {}, shrineOptions),
    })
    let previous = shrine.initialPlayerPosition
    for (const waypoint of prepared.waypoints) {
      expect(canTravelAlongMainlineSegment(previous, waypoint, shrine, {}, shrineOptions)).toBe(true)
      previous = waypoint
    }
  })

  it('never turns the lower-cafe-plant detour into a chair collision during movement preparation', () => {
    const route = findMainlinePathToEntity(cafe, 'commercial-cafe-plant-lower', cafe.initialPlayerPosition, {}, protagonistOptions).path

    expect(route).not.toBeNull()
    expectPreparedRouteToBeLiveLegal(cafe, cafe.initialPlayerPosition, route!)
  })

  it('still removes a redundant waypoint when its shortcut is live-legal', () => {
    const start = cafe.initialPlayerPosition
    const first = { x: start.x + dot.width, y: start.y }
    const target = { x: first.x + dot.width, y: first.y }
    const prepared = prepareMovementPath([
      start,
      first,
      target,
    ], start, {
      canOccupy: () => true,
      canTraverse: () => true,
    })

    expect(prepared.waypoints).toEqual([target])
  })
})
