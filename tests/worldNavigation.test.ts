import { currentCafeStart, currentCafeOptions, cafePoint } from './helpers/currentCafe'
import { mainlineNpcLabelFootprint } from '../src/center/runtime/sceneLayout'
import { describe, expect, it } from 'vitest'
import { doorPassageIsPassable, type DoorPassagePhase } from '../src/center/runtime/doorPassageModel'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'
import { createPolygonNavigationMesh } from '../src/center/runtime/scenePathfinding'
import { canActorReachPassageApproach, canTravelAlongMainlineSegment, classifyMainlineWorldCommand, findMainlinePath, findMainlineRoomPassageSequence, isMainlineNavigationBarrierClear, isWalkableMainlinePoint, mainlineNavigationCollisionBoxes, mainlinePassageCollisionForNavigation, mainlinePassageDoorwayForNavigation, mainlinePassageExitPoint, mainlinePassageSide, prepareMainlineWorldNavigation, resolveMainlineNpcPosition, resolveMainlineSeatSitPosition, resolveMainlineWorldNavigation } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineLabelFootprint, mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { defaultSceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId } from '../src/center/runtime/commercialCafeStory'
import { mainlineSceneOccupiedSeatIds } from '../src/center/runtime/mainlineSeating'
import { mainlineNpcStagedSeatId } from '../src/center/runtime/mainlineNpcStaging'

const point = (x: number, y: number) => ({ x, y })

describe('ordinary world navigation and passage intent', () => {
  it('keeps the public street lane continuously walkable west to east', () => {
    const street = mainlineScenes['commercial-street']
    const snapshot = createMainlineSceneGeometrySnapshot(street, point(18, 50))
    const options = { actorFootprint: { width: 1.2, height: 1.2 }, geometrySnapshot: snapshot }
    const leftmostWalkX = street.walkBounds.x + options.actorFootprint.width / 2 + .1
    const rightmostWalkX = street.walkBounds.x + street.walkBounds.width - options.actorFootprint.width / 2 - .1
    for (const y of [42, 50, 58]) {
      const samples = Array.from({ length: 18 }, (_, index) => leftmostWalkX + (rightmostWalkX - leftmostWalkX) * index / 17)
      const blocked = samples.filter(x => !isWalkableMainlinePoint(point(x, y), street, {}, options))
      expect(blocked, `blocked x coordinates on y=${y}`).toEqual([])
    }
    const rightmostWalkPoint = point(street.walkBounds.x + street.walkBounds.width - 1, 50)
    const route = resolveMainlineWorldNavigation(street, point(18, 50), rightmostWalkPoint, {}, options)
    expect(route?.reachedRequestedTarget).toBe(true)
    expect(route?.resolvedNavigableTarget).toEqual(rightmostWalkPoint)
    const rightEndRoute = resolveMainlineWorldNavigation(street, point(18, 50), rightmostWalkPoint, {}, options)
    expect(street.externalExits?.every(exit => exit.axis === 'x' && exit.direction === -1)).toBe(true)
    expect(isWalkableMainlinePoint(rightmostWalkPoint, street, {}, options)).toBe(true)
    expect(route?.reachedRequestedTarget).toBe(true)
    expect(route?.resolvedNavigableTarget).toEqual(rightmostWalkPoint)
  })

  it('resolves the 1180x757 stage click used to cross the storefront row', () => {
    const street = mainlineScenes['commercial-street']
    const screenMetrics = { width: 1180, height: 757, viewportWidth: 1180 }
    const from = point(34, 50)
    const target = point((1100 / 1180) * 100, (378 / 757) * 100)
    const dot = mainlineProtagonistDotFootprint(from, screenMetrics)
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(street, from, {}, screenMetrics)
    const options = { ...currentCafeOptions, actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height }, screenMetrics, geometrySnapshot }
    const route = resolveMainlineWorldNavigation(street, from, target, {}, options)
    expect(route?.reachedRequestedTarget).toBe(true)
    expect(route?.resolvedNavigableTarget).toEqual(target)
  })

  it('reuses a street navigation mesh across storefront visual phases with identical collision inputs', () => {
    const street = mainlineScenes['commercial-street']
    const storefrontId = 'commercial-north-slot-1'
    const screenMetrics = { width: 1180, height: 757, viewportWidth: 1180 }
    const makeSnapshot = (phase: 'baseline' | 'revealing' | 'revealed' | 'lingering' | 'restoring') => (
      createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, screenMetrics, new Map([[storefrontId, phase]]))
    )
    const baseline = prepareMainlineWorldNavigation(street, {}, {
      screenMetrics,
      geometrySnapshot: makeSnapshot('baseline'),
    })
    for (const phase of ['revealing', 'revealed', 'lingering', 'restoring'] as const) {
      const candidate = prepareMainlineWorldNavigation(street, {}, {
        screenMetrics,
        geometrySnapshot: makeSnapshot(phase),
      })
      expect(candidate.obstacles).toEqual(baseline.obstacles)
      expect(candidate.barriers).toEqual(baseline.barriers)
      expect(candidate.navigationMesh).toBe(baseline.navigationMesh)
    }
  })

  it('keeps route-through door geometry stable while invalidating actor, seat, and bounds changes', () => {
    const street = mainlineScenes['commercial-street']
    const screenMetrics = { width: 1180, height: 757, viewportWidth: 1180 }
    const snapshot = () => createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, screenMetrics)
    const baseline = prepareMainlineWorldNavigation(street, {}, {
      screenMetrics,
      actorFootprint: { width: 1.2, height: 1.2 },
      geometrySnapshot: snapshot(),
    })
    const seatId = street.objects.find(object => object.kind === 'seat')!.id
    const passage = street.passages.find(candidate => candidate.id === 'commercial-north-slot-1-entry')!
    const openOptions = { screenMetrics, actorFootprint: { width: 1.2, height: 1.2 }, openPassageIds: new Set([passage.id]), geometrySnapshot: snapshot() }
    const openDoor = prepareMainlineWorldNavigation(street, {}, openOptions)
    expect(openDoor.navigationMesh).toBe(baseline.navigationMesh)
    expect(openDoor.obstacles).toEqual(baseline.obstacles)
    expect(openDoor.physicalObstacles).not.toEqual(baseline.physicalObstacles)
    const doorwayCenter = { x: passage.collision.x + passage.collision.width / 2, y: passage.collision.y + passage.collision.height / 2 }
    expect(isWalkableMainlinePoint(doorwayCenter, street, {}, { ...openOptions, openPassageIds: new Set() })).toBe(false)
    expect(isWalkableMainlinePoint(doorwayCenter, street, {}, openOptions)).toBe(true)
    expect(passage.routeThrough).toBe(true)
    const closedOptions = { ...openOptions, openPassageIds: new Set<string>() }
    const approach = canActorReachPassageApproach(street, passage, street.initialPlayerPosition, {}, closedOptions)
    expect(approach?.path).not.toBeNull()
    expect(classifyMainlineWorldCommand(street, street.initialPlayerPosition, passage.crossingTargets[0], {}, closedOptions).kind).toBe('passage')
    const variants = [
      prepareMainlineWorldNavigation(street, {}, {
        screenMetrics, actorFootprint: { width: 1.4, height: 1.2 }, geometrySnapshot: snapshot(),
      }).navigationMesh,
      prepareMainlineWorldNavigation(street, {}, {
        screenMetrics, actorFootprint: { width: 1.2, height: 1.2 }, occupiedSeatIds: new Set([seatId]), geometrySnapshot: snapshot(),
      }).navigationMesh,
      prepareMainlineWorldNavigation(street, {}, {
        screenMetrics: { ...screenMetrics, width: 1181, viewportWidth: 1181 },
        actorFootprint: { width: 1.2, height: 1.2 },
        geometrySnapshot: createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, { ...screenMetrics, width: 1181, viewportWidth: 1181 }),
      }).navigationMesh,
    ]
    variants.forEach(mesh => expect(mesh).not.toBe(baseline.navigationMesh))
  })

  it('stops a running route at a front door that changes from open to closing', () => {
    const street = mainlineScenes['commercial-street']
    const screenMetrics = { width: 1180, height: 757, viewportWidth: 1180 }
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, screenMetrics)
    const passage = street.passages.find(candidate => candidate.id === 'commercial-north-slot-1-entry')!
    const start = passage.thresholds[0]!
    let phase: DoorPassagePhase = 'open'
    const currentOptions = () => ({
      actorId: 'protagonist',
      actorFootprint: { width: 1.2, height: 1.2 },
      screenMetrics,
      geometrySnapshot,
      openPassageIds: new Set(doorPassageIsPassable(phase) ? [passage.id] : []),
    })
    const doorway = mainlinePassageDoorwayForNavigation(street, passage, currentOptions())
    const collision = mainlinePassageCollisionForNavigation(street, passage, currentOptions())
    const exitPoint = mainlinePassageExitPoint(passage, start, { width: 1.2, height: 1.2 }, collision, doorway)
    const movement = createFreeRoamController(start)
    let arrived = 0
    let blocked = 0
    movement.moveAlong([start, exitPoint], () => { arrived += 1 }, {
      maxSpeed: .012,
      canOccupy: position => isWalkableMainlinePoint(position, street, {}, currentOptions()),
      canTraverse: (start, end) => isMainlineNavigationBarrierClear(start, end, street, {}, currentOptions()),
      onBlocked: () => { blocked += 1 },
    })

    const center = { x: collision.x + collision.width / 2, y: collision.y + collision.height / 2 }
    const sourceSide = mainlinePassageSide(passage, start, collision, doorway)
    for (let now = 16; now < 30_000 && movement.isMoving(); now += 16) {
      const position = movement.getCurrentPosition()
      const distanceToDoor = Math.hypot(position.x - center.x, position.y - center.y)
      if (phase === 'open' && mainlinePassageSide(passage, position, collision, doorway) === sourceSide && distanceToDoor <= 2.5) {
        phase = 'closing'
      }
      movement.tick(now)
      if (phase === 'closing' && !movement.isMoving()) break
    }

    expect(phase).toBe('closing')
    expect(blocked).toBe(1)
    expect(arrived).toBe(0)
    expect(mainlinePassageSide(passage, movement.getCurrentPosition(), collision, doorway)).toBe(sourceSide)
    expect(isWalkableMainlinePoint(movement.getCurrentPosition(), street, {}, currentOptions())).toBe(true)
  }, 30_000)

  it('rechecks a later storefront door when a route crosses from one interior to another', () => {
    const street = mainlineScenes['commercial-street']
    const screenMetrics = currentCafeOptions.screenMetrics
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, screenMetrics)
    const northPassage = street.passages.find(candidate => candidate.id === 'commercial-north-slot-1-entry')!
    const southPassage = street.passages.find(candidate => candidate.id === 'commercial-south-slot-1-entry')!
    const northRoom = street.rooms.find(candidate => candidate.id === northPassage.toRoomId)!
    const southRoom = street.rooms.find(candidate => candidate.id === southPassage.toRoomId)!
    const start = northPassage.crossingTargets[0]
    const target = southPassage.crossingTargets[0]
    let southPhase: DoorPassagePhase = 'open'
    const currentOptions = () => ({
      actorId: 'protagonist',
      actorFootprint: currentCafeOptions.actorFootprint,
      screenMetrics,
      geometrySnapshot,
      openPassageIds: new Set([northPassage.id, ...(doorPassageIsPassable(southPhase) ? [southPassage.id] : [])]),
    })
    const path = findMainlinePath(start, target, street, {}, currentOptions())
    expect(path).not.toBeNull()

    const movement = createFreeRoamController(start)
    let arrived = 0
    let blocked = 0
    movement.moveAlong(path!, () => { arrived += 1 }, {
      maxSpeed: .018,
      canOccupy: position => isWalkableMainlinePoint(position, street, {}, currentOptions()),
      canTraverse: (from, to) => isMainlineNavigationBarrierClear(from, to, street, {}, currentOptions()),
      onBlocked: () => { blocked += 1 },
    })
    const sourceSide = mainlinePassageSide(southPassage, start)
    const doorway = southPassage.collision
    const center = { x: doorway.x + doorway.width / 2, y: doorway.y + doorway.height / 2 }
    for (let now = 16; now < 60_000 && movement.isMoving(); now += 16) {
      const position = movement.getCurrentPosition()
      if (southPhase === 'open'
        && mainlinePassageSide(southPassage, position) === sourceSide
        && Math.hypot(position.x - center.x, position.y - center.y) <= 4) {
        southPhase = 'closing'
      }
      movement.tick(now)
      if (southPhase === 'closing' && !movement.isMoving()) break
    }

    expect(southPhase).toBe('closing')
    expect(blocked).toBe(1)
    expect(arrived).toBe(0)
    expect(mainlinePassageSide(southPassage, movement.getCurrentPosition())).toBe(sourceSide)
  }, 60_000)

  it('keeps locked rear-door collision and access denial in the live movement checks', () => {
    const street = mainlineScenes['commercial-street']
    const screenMetrics = currentCafeOptions.screenMetrics
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, screenMetrics)
    const entry = street.passages.find(candidate => candidate.id === 'commercial-north-slot-1-entry')!
    const rear = street.passages.find(candidate => candidate.id === `${entry.toRoomId}-rear-door`)!
    const room = street.rooms.find(candidate => candidate.id === entry.toRoomId)!
    const interior = resolveMainlineNpcPosition(street,'fruit-tea-trial-worker')
    const options = { ...currentCafeOptions, actorId: 'fruit-tea-trial-worker', actorFootprint: { width:16/19.2, height:16/10.8 }, screenMetrics, geometrySnapshot, openPassageIds: new Set([entry.id]) }
    const rearCenter = { x: rear.collision.x + rear.collision.width / 2, y: rear.collision.y + rear.collision.height / 2 }
    expect(rear.access).toBe('locked')
    expect(rear.routeThrough).not.toBe(true)
    expect(isWalkableMainlinePoint(rearCenter, street, {}, options)).toBe(false)
    expect(findMainlinePath(interior, rear.crossingTargets[0], street, {}, options)).toBeNull()
    const rearCommand = classifyMainlineWorldCommand(street, interior, rear.crossingTargets[0], {}, options)
    expect(rearCommand.kind).toBe('passage')
    if (rearCommand.kind === 'passage') expect(rearCommand.passage.access).toBe('locked')

    const cafe = mainlineScenes['commercial-cafe']
    const staff = cafe.accessRegions.find(region => region.id === 'commercial-cafe-staff-area')!
    const staffTarget = { x: staff.x + staff.width / 2, y: staff.y + staff.height / 2 }
    const cafeGeometry = createMainlineSceneGeometrySnapshot(cafe, currentCafeStart, {},currentCafeOptions.screenMetrics)
    const cafeOptions = { ...currentCafeOptions, actorId: 'protagonist', geometrySnapshot: cafeGeometry }
    const movement = createFreeRoamController(currentCafeStart)
    let arrived = 0
    let blocked = 0
    movement.moveAlong([currentCafeStart, staffTarget], () => { arrived += 1 }, {
      maxSpeed: .018,
      canOccupy: position => isWalkableMainlinePoint(position, cafe, {}, cafeOptions),
      canTraverse: (from, to) => isMainlineNavigationBarrierClear(from, to, cafe, {}, cafeOptions),
      onBlocked: () => { blocked += 1 },
    })
    for (let now = 16; now < 30_000 && movement.isMoving(); now += 16) movement.tick(now)
    expect(blocked).toBe(1)
    expect(arrived).toBe(0)
    expect(movement.getCurrentPosition()).not.toEqual(staffTarget)
    expect(isWalkableMainlinePoint(movement.getCurrentPosition(), cafe, {}, cafeOptions)).toBe(true)
  }, 60_000)

  it('invalidates the prepared static mesh when a compiled obstacle or navigation barrier changes', () => {
    const street = mainlineScenes['commercial-street']
    const screenMetrics = { width: 1180, height: 757, viewportWidth: 1180 }
    const snapshot = createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, screenMetrics)
    const options = { screenMetrics, actorFootprint: { width: 1.2, height: 1.2 } }
    const baseline = prepareMainlineWorldNavigation(street, {}, { ...options, geometrySnapshot: snapshot })

    const blockerIndex = snapshot.units.findIndex(unit => unit.navigation.blocked && !unit.navigation.passageId && !unit.navigation.opensWithPassageId)
    expect(blockerIndex).toBeGreaterThanOrEqual(0)
    const shiftedUnits = snapshot.units.map((unit, index) => index === blockerIndex ? { ...unit, x: unit.x + .5 } : unit)
    const withShiftedObstacle = prepareMainlineWorldNavigation(street, {}, {
      ...options,
      geometrySnapshot: { ...snapshot, units: shiftedUnits },
    })
    expect(withShiftedObstacle.obstacles).not.toEqual(baseline.obstacles)
    expect(withShiftedObstacle.navigationMesh).not.toBe(baseline.navigationMesh)

    const extraBarrier = {
      id: 'cache-invalidation-test-barrier',
      start: point(20, 20),
      end: point(24, 20),
      kind: 'relation' as const,
    }
    const withExtraBarrier = prepareMainlineWorldNavigation(street, {}, {
      ...options,
      geometrySnapshot: { ...snapshot, navigationBarriers: [...snapshot.navigationBarriers, extraBarrier] },
    })
    expect(withExtraBarrier.barriers).not.toEqual(baseline.barriers)
    expect(withExtraBarrier.navigationMesh).not.toBe(baseline.navigationMesh)
  })

  it('bounds prepared static meshes to an eight-entry per-scene LRU', () => {
    const street = mainlineScenes['commercial-street']
    const screenMetrics = { width: 1180, height: 757, viewportWidth: 1180 }
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, screenMetrics)
    const prepare = (width: number) => prepareMainlineWorldNavigation(street, {}, {
      screenMetrics,
      actorFootprint: { width, height: 1.2 },
      geometrySnapshot,
    }).navigationMesh

    const first = prepare(1.2)
    const second = prepare(1.3)
    for (let index = 2; index < 8; index += 1) prepare(1.2 + index / 10)
    expect(prepare(1.2)).toBe(first) // Refresh the oldest entry before inserting a ninth key.
    prepare(2.0)

    expect(prepare(1.3)).not.toBe(second) // The least recently used entry was evicted.
    expect(prepare(1.2)).toBe(first)
  })

  it('projects only onto the start component while keeping an exact reachable target', () => {
    const gridUnit = 20
    const halfGrid = gridUnit / 2
    const gridBounds = { x: gridUnit - gridUnit, y: gridUnit - gridUnit, width: gridUnit, height: gridUnit }
    const splitStart = point(gridBounds.x + halfGrid, gridBounds.y)
    const splitEnd = point(gridBounds.x + halfGrid, gridBounds.y + gridBounds.height)
    const source = point(gridBounds.x + gridUnit / 10, gridBounds.y + gridUnit / 10)
    const reachableTarget = point(gridBounds.x + gridUnit / 5, gridBounds.y + gridBounds.height - gridUnit / 10)
    const separatedTarget = point(gridBounds.x + gridBounds.width - gridUnit / 10, gridBounds.y + gridUnit / 10)
    const mesh = createPolygonNavigationMesh({
      bounds: gridBounds,
      obstacles: [],
      barriers: [{ id: 'split', start: splitStart, end: splitEnd, kind: 'relation' }],
      actorFootprint: { width: 1, height: 1 },
    })
    const reachable = mesh.resolvePath(source, reachableTarget)!
    expect(reachable.reachedRequestedTarget).toBe(true)
    expect(reachable.resolvedNavigableTarget).toEqual(reachableTarget)

    const separated = mesh.resolvePath(source, separatedTarget)!
    expect(separated.reachedRequestedTarget).toBe(false)
    expect(separated.resolvedNavigableTarget.x).toBeLessThanOrEqual(splitStart.x)
    expect(separated.path.at(-1)).toEqual(separated.resolvedNavigableTarget)

    const boundaryClick = mesh.resolvePath(source, point(splitStart.x, gridBounds.y + halfGrid))!
    expect(boundaryClick.reachedRequestedTarget).toBe(false)
    expect(boundaryClick.resolvedNavigableTarget.x).toBeLessThan(splitStart.x)
    expect(boundaryClick.path.at(-1)).toEqual(boundaryClick.resolvedNavigableTarget)
  })

  it('keeps a reachable world click raw, projects blocked/access targets once, and honors actor access', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const dot = mainlineProtagonistDotFootprint(currentCafeStart,currentCafeOptions.screenMetrics)
    const options = { ...currentCafeOptions, actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height } } as const
    const openGround = currentCafeStart
    const open = resolveMainlineWorldNavigation(cafe, currentCafeStart, openGround, {}, options)!
    expect(open.reachedRequestedTarget).toBe(true)
    expect(open.resolvedNavigableTarget).toEqual(openGround)

    const counter = cafe.continuousStructures.find((structure) => structure.id === 'cafe-trial-counter-long-body')!
    const insideCounter = { x: counter.x + counter.width / 2, y: counter.y + counter.height / 2 }
    const projected = resolveMainlineWorldNavigation(cafe, currentCafeStart, insideCounter, {}, options)!
    expect(projected.reachedRequestedTarget).toBe(false)
    expect(projected.resolvedNavigableTarget).not.toEqual(insideCounter)

    const staff = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const staffTarget = { x: staff.x + staff.width / 2, y: staff.y + staff.height / 2 }
    const denied = resolveMainlineWorldNavigation(cafe, currentCafeStart, staffTarget, {}, options)!
    expect(denied.reachedRequestedTarget).toBe(false)
    expect(denied.deniedAccessRegion?.id).toBe(staff.id)
    expect(denied.resolvedNavigableTarget.x).toBeGreaterThan(staff.x + staff.width)
    expect(mainlineNavigationCollisionBoxes(cafe, {}, options)).not.toContainEqual({ x: staff.x, y: staff.y, width: staff.width, height: staff.height })
    expect(denied.resolvedNavigableTarget).not.toEqual(staffTarget)
    const allowed = resolveMainlineWorldNavigation(cafe, currentCafeStart, staffTarget, {}, { ...currentCafeOptions, actorId: commercialCafeCoffeeOwnerNpcId })!
    expect(allowed.reachedRequestedTarget).toBe(true)
    const floorServerDenied = resolveMainlineWorldNavigation(cafe, currentCafeStart, staffTarget, {}, { ...currentCafeOptions, actorId: commercialCafeFloorServerNpcId })!
    expect(floorServerDenied.reachedRequestedTarget).toBe(false)
  })

  it('derives distinct public contacts at the actual upper-right employee opening without projecting through the counter',()=>{
 const cafe=mainlineScenes['commercial-street'],staff=cafe.accessRegions.find(r=>r.id==='commercial-cafe-staff-area')!,from=cafePoint(228,56)
 const contacts=[.2,.4,.6,.8].map(fraction=>{
  const result=resolveMainlineWorldNavigation(cafe,from,cafePoint(180,44+fraction*24),{},currentCafeOptions)!
  expect(result).not.toBeNull();expect(result.deniedAccessRegion?.id).toBe(staff.id)
  expect(result.resolvedNavigableTarget.x).toBeGreaterThan(staff.x+staff.width+currentCafeOptions.actorFootprint.width/2)
  for(let i=1;i<result.path.length;i++)expect(canTravelAlongMainlineSegment(result.path[i-1],result.path[i],cafe,{},currentCafeOptions)).toBe(true)
  return result.resolvedNavigableTarget.y
 })
 expect(new Set(contacts).size).toBeGreaterThan(2)
})

  it('preserves distinct incoming tangents on the usable Office doorway span', () => {
    const office = mainlineScenes['zhongshuyuan-office']
    const passage = office.passages.find(p => p.id === 'zhongshuyuan-office-south-door-1')!
    const doorway = mainlinePassageDoorwayForNavigation(office, passage)
    const dot = mainlineProtagonistDotFootprint(office.initialPlayerPosition)
    const options = { actorFootprint: { width: dot.width, height: dot.height } }
    const tangents = [.25, .5, .75].map(fraction => {
      const from = { x: doorway.x + doorway.width * fraction, y: doorway.y - doorway.height * 3 }
      const approach = canActorReachPassageApproach(office, passage, from, {}, options)!
      expect(approach).not.toBeNull()
      const exit = mainlinePassageExitPoint(passage, approach.target, options.actorFootprint)
      expect(exit.x).toBeCloseTo(approach.target.x, 5)
      expect(mainlinePassageSide(passage, exit)).not.toBe(mainlinePassageSide(passage, approach.target))
      return approach.target.x
    })
    expect(new Set(tangents).size).toBe(3)
  })

  it('keeps denied room edges terminal rather than traversing them to other rooms', () => {
    const office = mainlineScenes['zhongshuyuan-office']
    const closedStart = { ...office, passages: office.passages.map(p => ({ ...p, access: 'locked' as const })) }
    const room = office.rooms.find(r => r.id.endsWith('north-room-4'))!
    const target = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
    expect(findMainlineRoomPassageSequence(closedStart, office.initialPlayerPosition, target)).toBeNull()
    const route = findMainlineRoomPassageSequence(office, office.initialPlayerPosition, target)!
    expect(route.passages.slice(0, -1).every(p => p.access === 'open')).toBe(true)
    expect(route.passages.at(-1)?.access).toBe('locked')
  })

  it('uses the same closed-passage geometry for world resolution and live travel', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const dot = mainlineProtagonistDotFootprint(currentCafeStart,currentCafeOptions.screenMetrics)
    const options = { ...currentCafeOptions, actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height } } as const
    const staff = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const requestedTarget = { x: staff.x + staff.width / 2, y: staff.y + staff.height / 2 }
    const resolution = resolveMainlineWorldNavigation(cafe, currentCafeStart, requestedTarget, {}, options)!

    expect(resolution.reachedRequestedTarget).toBe(false)
    expect(resolution.path.at(-1)).toEqual(resolution.resolvedNavigableTarget)
    for (let index = 1; index < resolution.path.length; index += 1) {
      expect(canTravelAlongMainlineSegment(resolution.path[index - 1]!, resolution.path[index]!, cafe, {}, options)).toBe(true)
    }
  })

  it('keeps a passage closed for both planning and live travel until its lifecycle marks it open', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const exit = cafe.passages.find((passage) => passage.id === 'street-cafe-entry')!
    const doorway = mainlinePassageDoorwayForNavigation(cafe, exit)
    const center = { x: doorway.x + doorway.width / 2, y: doorway.y + doorway.height / 2 }
    const coversDoorwayCenter = (boxes: readonly { x: number; y: number; width: number; height: number }[]) => (
      boxes.some((box) => center.x > box.x && center.x < box.x + box.width && center.y > box.y && center.y < box.y + box.height)
    )

    const opened = { openPassageIds: new Set([exit.id]) }
    // `collisionBoxes()` is the single source consumed by world meshes and
    // live `isWalkableMainlinePoint`; opening flips this same geometry once.
    expect(coversDoorwayCenter(mainlineNavigationCollisionBoxes(cafe))).toBe(true)
    expect(coversDoorwayCenter(mainlineNavigationCollisionBoxes(cafe, {}, opened))).toBe(false)
  })

  it('requires exact actor-specific reachability before a passage can participate', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const backDoor = cafe.passages.find((passage) => passage.id === 'commercial-north-cafe-interior-rear-door')!
    const protagonistDot = mainlineProtagonistDotFootprint(currentCafeStart,currentCafeOptions.screenMetrics)
    const protagonistOptions = { actorId: 'protagonist', actorFootprint: { width: protagonistDot.width, height: protagonistDot.height } } as const
    const coffeeOwnerPosition = resolveMainlineNpcPosition(cafe, commercialCafeCoffeeOwnerNpcId)

    expect(canActorReachPassageApproach(cafe, backDoor, currentCafeStart, {}, protagonistOptions)).toBeNull()
    expect(coffeeOwnerPosition).toBeDefined()
    expect(canActorReachPassageApproach(cafe, backDoor, coffeeOwnerPosition!, {}, { actorId: commercialCafeCoffeeOwnerNpcId })).not.toBeNull()

    const backDoorTarget = mainlinePassageExitPoint(backDoor, currentCafeStart)
    expect(classifyMainlineWorldCommand(cafe, currentCafeStart, backDoorTarget, {}, protagonistOptions)).toMatchObject({ kind: 'ordinary' })
    expect(classifyMainlineWorldCommand(cafe, coffeeOwnerPosition!, backDoorTarget, {}, { actorId: commercialCafeCoffeeOwnerNpcId })).toMatchObject({ kind: 'passage', passage: { id: backDoor.id } })
  })

  it('keeps Lao Zhou able to reach the real Café street passage from his conversation seat', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const exit = cafe.passages.find((passage) => passage.id === 'street-cafe-entry')!
    const seatId = 'commercial-cafe-right-window-upper-group-chair-top'
    const seated = resolveMainlineSeatSitPosition(cafe, seatId)
    expect(seated).not.toBeNull()
    expect(canActorReachPassageApproach(cafe, exit, seated!, {}, { screenMetrics:currentCafeOptions.screenMetrics, actorId:'lao-zhou', actorFootprint:{width:16/19.2,height:16/10.8}, occupiedSeatIds:mainlineSceneOccupiedSeatIds(cafe) })).not.toBeNull()
  })

  it('routes Lao Zhou from his authored Café conversation seat to the opposite side of the street passage', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const exit = cafe.passages.find((passage) => passage.id === 'street-cafe-entry')!
    const seated = resolveMainlineNpcPosition(cafe, 'lao-zhou', {}, { screenMetrics: currentCafeOptions.screenMetrics })
    const footprint = mainlineNpcLabelFootprint(cafe, 'lao-zhou', seated, currentCafeOptions.screenMetrics)
    const options = { actorId: 'lao-zhou', screenMetrics: currentCafeOptions.screenMetrics, actorFootprint: { width: footprint.width, height: footprint.height } }
    const collision = mainlinePassageCollisionForNavigation(cafe, exit, options)
    const doorway = mainlinePassageDoorwayForNavigation(cafe, exit, options)
    const outsideTarget = mainlinePassageExitPoint(exit, seated, options.actorFootprint, collision, doorway)
    expect(seated).not.toBeNull()
    expect(canActorReachPassageApproach(cafe, exit, seated, {}, options)).not.toBeNull()
    expect(mainlinePassageSide(exit, outsideTarget, collision, doorway)).not.toBe(mainlinePassageSide(exit, seated, collision, doorway))
  })

  it('keeps the seated NPC route valid until its occupied chair is released', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const exit = cafe.passages.find((passage) => passage.id === 'street-cafe-entry')!
    const from = resolveMainlineNpcPosition(cafe, 'lao-zhou', {}, { screenMetrics: currentCafeOptions.screenMetrics })
    const footprint = mainlineNpcLabelFootprint(cafe, 'lao-zhou', from, currentCafeOptions.screenMetrics)
    const laoZhouSeatId = mainlineNpcStagedSeatId(cafe, 'lao-zhou')!
    const occupiedSeatIds = mainlineSceneOccupiedSeatIds(cafe)
    const options = { actorId: 'lao-zhou', screenMetrics: currentCafeOptions.screenMetrics, actorFootprint: { width: footprint.width, height: footprint.height }, occupiedSeatIds }
    expect(occupiedSeatIds.has(laoZhouSeatId)).toBe(true)
    expect(canActorReachPassageApproach(cafe, exit, from, {}, options)).not.toBeNull()
    const releasedSeatIds = new Set(occupiedSeatIds)
    releasedSeatIds.delete(laoZhouSeatId)
    expect(canActorReachPassageApproach(cafe, exit, from, {}, { ...options, occupiedSeatIds: releasedSeatIds })).toBeNull()
  })

  it('classifies passages before ordinary target resolution, including Yonghe’s open rear entrance', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const ordinary = classifyMainlineWorldCommand(cafe, currentCafeStart, currentCafeStart)
    expect(ordinary.kind).toBe('ordinary')

    const street = cafe.passages.find((passage) => passage.id === 'street-cafe-entry')!
    const streetTarget = mainlinePassageExitPoint(street, currentCafeStart)
    const crossScene = classifyMainlineWorldCommand(cafe, currentCafeStart, streetTarget)
    expect(crossScene).toMatchObject({ kind: 'passage', passage: { id: street.id }, requestedTarget: streetTarget })

    const eatery = mainlineScenes['yonghe-eatery']
    const rearEntrance = eatery.passages.find((passage) => passage.id === 'yonghe-back-door')!
    const alleyRoom = eatery.rooms.find(room => room.id === 'mining-street-back-alley')!
    const outsideYonghe = rearEntrance.crossingTargets.find(point => point.x > alleyRoom.bounds.x && point.x < alleyRoom.bounds.x + alleyRoom.bounds.width && point.y > alleyRoom.bounds.y && point.y < alleyRoom.bounds.y + alleyRoom.bounds.height)!
    const rearEntranceTarget = mainlinePassageExitPoint(rearEntrance, outsideYonghe)
    expect(rearEntrance).toMatchObject({ access: 'open', routeThrough: true, fromRoomId: alleyRoom.id, toRoomId: 'mining-shop-2-interior' })
    const rearEntrancePlan = classifyMainlineWorldCommand(eatery, outsideYonghe, rearEntranceTarget, {}, { actorId: 'yonghe-trial-worker' })
    expect(rearEntrancePlan).toMatchObject({ kind: 'passage', passage: { id: rearEntrance.id }, requestedTarget: rearEntranceTarget })
  })

  it('limits storefront passage intent to the clicked storefront slot, not its entire parent wall', () => {
    const perimeter = mainlineScenes['yonghe-mining-perimeter']
    const entrance = perimeter.passages.find((passage) => passage.id === 'yonghe-street-entry')!
    const storefront = perimeter.storefronts.find((candidate) => candidate.portalId === entrance.portalId)!
    const sourceThreshold = entrance.thresholds[0]
    const slotSpan = storefront.end - storefront.start
    const outsideSlot = { x: storefront.end + slotSpan, y: sourceThreshold.y }
    const shopRoom = perimeter.rooms.find(room => room.id === 'mining-shop-2-interior')!
    const insideSlot = entrance.crossingTargets.find(point => point.x > shopRoom.bounds.x && point.x < shopRoom.bounds.x + shopRoom.bounds.width && point.y > shopRoom.bounds.y && point.y < shopRoom.bounds.y + shopRoom.bounds.height)!

    expect(classifyMainlineWorldCommand(perimeter, perimeter.initialPlayerPosition, outsideSlot)).toMatchObject({ kind: 'ordinary' })
    expect(classifyMainlineWorldCommand(perimeter, perimeter.initialPlayerPosition, insideSlot)).toMatchObject({ kind: 'passage', passage: { id: entrance.id } })
  })

  it('routes an Office target room through its locked semantic edge without treating the door as open', () => {
    const office = mainlineScenes['zhongshuyuan-office']
    const start = office.initialPlayerPosition
    const targetRoom = office.rooms.find((room) => room.id === 'zhongshuyuan-office-north-room-4')!
    const target = point(targetRoom.bounds.x + targetRoom.bounds.width / 2, targetRoom.bounds.y + targetRoom.bounds.height / 2)
    const plan = classifyMainlineWorldCommand(office, start, target)
    expect(plan.kind).toBe('passage')
    if (plan.kind !== 'passage') throw new Error('Locked target must retain passage intent')
    expect(plan.passages.at(-1)).toMatchObject({ access: 'locked', toRoomId: targetRoom.id })
    expect(plan.approachPath).not.toBeNull()
    expect(plan.approachPath!.at(-1)).not.toEqual(target)
  })

  it('keeps a same-scene room queue intact before ordinary continuation', () => {
    const authoredOffice = mainlineScenes['zhongshuyuan-office']
    const office = {
      ...authoredOffice,
      passages: authoredOffice.passages.map((passage) => ({ ...passage, access: 'open' as const })),
    }
    const start = office.initialPlayerPosition
    const candidates = office.rooms.flatMap((room) => {
      const target = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
      const sequence = findMainlineRoomPassageSequence(
        office,
        start,
        target,
        {},
        { openPassageIds: new Set(office.passages.map((passage) => passage.id)) },
      )
      return sequence && sequence.passages.length >= 2 ? [sequence] : []
    })
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0]!.passages.length).toBeGreaterThanOrEqual(2)
  })
})
