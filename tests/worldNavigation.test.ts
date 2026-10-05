import { describe, expect, it } from 'vitest'
import { createPolygonNavigationMesh } from '../src/center/runtime/scenePathfinding'
import { canActorReachPassageApproach, canTravelAlongMainlineSegment, classifyMainlineWorldCommand, findMainlineRoomPassageSequence, mainlineNavigationCollisionBoxes, mainlinePassageCollisionForNavigation, mainlinePassageDoorwayForNavigation, mainlinePassageExitPoint, mainlinePassageSide, resolveMainlineNpcPosition, resolveMainlineSeatSitPosition, resolveMainlineWorldNavigation } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineLabelFootprint, mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { defaultSceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId } from '../src/center/runtime/commercialCafeStory'
import { mainlineSceneOccupiedSeatIds } from '../src/center/runtime/mainlineSeating'
import { mainlineNpcStagedSeatId } from '../src/center/runtime/mainlineNpcStaging'

const point = (x: number, y: number) => ({ x, y })

describe('ordinary world navigation and passage intent', () => {
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
    const dot = mainlineProtagonistDotFootprint(cafe.initialPlayerPosition)
    const options = { actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height } } as const
    const openGround = cafe.initialPlayerPosition
    const open = resolveMainlineWorldNavigation(cafe, cafe.initialPlayerPosition, openGround, {}, options)!
    expect(open.reachedRequestedTarget).toBe(true)
    expect(open.resolvedNavigableTarget).toEqual(openGround)

    const counter = cafe.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')!
    const insideCounter = { x: counter.x + counter.width / 2, y: counter.y + counter.height / 2 }
    const projected = resolveMainlineWorldNavigation(cafe, cafe.initialPlayerPosition, insideCounter, {}, options)!
    expect(projected.reachedRequestedTarget).toBe(false)
    expect(projected.resolvedNavigableTarget).not.toEqual(insideCounter)

    const staff = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const staffTarget = { x: staff.x + staff.width / 2, y: staff.y + staff.height / 2 }
    const denied = resolveMainlineWorldNavigation(cafe, cafe.initialPlayerPosition, staffTarget, {}, options)!
    expect(denied.reachedRequestedTarget).toBe(false)
    expect(denied.deniedAccessRegion?.id).toBe(staff.id)
    expect(denied.resolvedNavigableTarget.x).toBeGreaterThan(staff.x + staff.width)
    expect(mainlineNavigationCollisionBoxes(cafe, {}, options)).not.toContainEqual({ x: staff.x, y: staff.y, width: staff.width, height: staff.height })
    expect(denied.resolvedNavigableTarget).not.toEqual(staffTarget)
    const allowed = resolveMainlineWorldNavigation(cafe, cafe.initialPlayerPosition, staffTarget, {}, { actorId: commercialCafeCoffeeOwnerNpcId })!
    expect(allowed.reachedRequestedTarget).toBe(true)
    const floorServerDenied = resolveMainlineWorldNavigation(cafe, cafe.initialPlayerPosition, staffTarget, {}, { actorId: commercialCafeFloorServerNpcId })!
    expect(floorServerDenied.reachedRequestedTarget).toBe(false)
  })

  it('derives distinct public contacts along the declared access boundary, including the top wall', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const staff = cafe.accessRegions[0]!
    const from = { x: staff.x + staff.width + 7, y: staff.y + 1 }
    const dot = mainlineProtagonistDotFootprint(from)
    const options = { actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height } }
    const contacts = [staff.y - .2, staff.y + 1, staff.y + staff.height / 2, staff.y + staff.height - 1].map(y => {
      const result = resolveMainlineWorldNavigation(cafe, from, { x: staff.x + staff.width - 2, y }, {}, options)!
      expect(result.deniedAccessRegion?.id).toBe(staff.id)
      expect(result.resolvedNavigableTarget.x).toBeGreaterThan(staff.x + staff.width + dot.width / 2)
      for (let i = 1; i < result.path.length; i++) expect(canTravelAlongMainlineSegment(result.path[i - 1]!, result.path[i]!, cafe, {}, options)).toBe(true)
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
    const dot = mainlineProtagonistDotFootprint(cafe.initialPlayerPosition)
    const options = { actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height } } as const
    const staff = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const requestedTarget = { x: staff.x + staff.width / 2, y: staff.y + staff.height / 2 }
    const resolution = resolveMainlineWorldNavigation(cafe, cafe.initialPlayerPosition, requestedTarget, {}, options)!

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
    const backDoor = cafe.passages.find((passage) => passage.id === 'cafe-back-door')!
    const protagonistDot = mainlineProtagonistDotFootprint(cafe.initialPlayerPosition)
    const protagonistOptions = { actorId: 'protagonist', actorFootprint: { width: protagonistDot.width, height: protagonistDot.height } } as const
    const coffeeOwnerPosition = resolveMainlineNpcPosition(cafe, commercialCafeCoffeeOwnerNpcId)

    expect(canActorReachPassageApproach(cafe, backDoor, cafe.initialPlayerPosition, {}, protagonistOptions)).toBeNull()
    expect(coffeeOwnerPosition).toBeDefined()
    expect(canActorReachPassageApproach(cafe, backDoor, coffeeOwnerPosition!, {}, { actorId: commercialCafeCoffeeOwnerNpcId })).not.toBeNull()

    const backDoorTarget = mainlinePassageExitPoint(backDoor, cafe.initialPlayerPosition)
    expect(classifyMainlineWorldCommand(cafe, cafe.initialPlayerPosition, backDoorTarget, {}, protagonistOptions)).toMatchObject({ kind: 'ordinary' })
    expect(classifyMainlineWorldCommand(cafe, coffeeOwnerPosition!, backDoorTarget, {}, { actorId: commercialCafeCoffeeOwnerNpcId })).toMatchObject({ kind: 'passage', passage: { id: backDoor.id } })
  })

  it('keeps Lao Zhou able to reach the real Café street passage from his conversation seat', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const exit = cafe.passages.find((passage) => passage.id === 'street-cafe-entry')!
    const seatId = 'commercial-cafe-right-window-upper-group-chair-top'
    const seated = resolveMainlineSeatSitPosition(cafe, seatId)
    expect(seated).not.toBeNull()
    expect(canActorReachPassageApproach(cafe, exit, seated!, {}, { actorId: 'lao-zhou' })).not.toBeNull()
  })

  it('routes Lao Zhou from his authored Café conversation seat to the opposite side of the street passage', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const exit = cafe.passages.find((passage) => passage.id === 'street-cafe-entry')!
    const seated = resolveMainlineNpcPosition(cafe, 'lao-zhou', {}, { screenMetrics: defaultSceneScreenMetrics })
    const footprint = mainlineLabelFootprint('老周', seated, defaultSceneScreenMetrics, { lineHeight: 1 })
    const options = { actorId: 'lao-zhou', screenMetrics: defaultSceneScreenMetrics, actorFootprint: { width: footprint.width, height: footprint.height } }
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
    const from = resolveMainlineNpcPosition(cafe, 'lao-zhou', {}, { screenMetrics: defaultSceneScreenMetrics })
    const footprint = mainlineLabelFootprint('老周', from, defaultSceneScreenMetrics, { lineHeight: 1 })
    const laoZhouSeatId = mainlineNpcStagedSeatId(cafe, 'lao-zhou')!
    const occupiedSeatIds = mainlineSceneOccupiedSeatIds(cafe)
    const options = { actorId: 'lao-zhou', screenMetrics: defaultSceneScreenMetrics, actorFootprint: { width: footprint.width, height: footprint.height }, occupiedSeatIds }
    expect(occupiedSeatIds.has(laoZhouSeatId)).toBe(true)
    expect(canActorReachPassageApproach(cafe, exit, from, {}, options)).not.toBeNull()
    const releasedSeatIds = new Set(occupiedSeatIds)
    releasedSeatIds.delete(laoZhouSeatId)
    expect(canActorReachPassageApproach(cafe, exit, from, {}, { ...options, occupiedSeatIds: releasedSeatIds })).toBeNull()
  })

  it('classifies passages before ordinary target resolution, including a locked non-routeThrough back door', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const ordinary = classifyMainlineWorldCommand(cafe, cafe.initialPlayerPosition, cafe.initialPlayerPosition)
    expect(ordinary.kind).toBe('ordinary')

    const street = cafe.passages.find((passage) => passage.id === 'street-cafe-entry')!
    const streetTarget = mainlinePassageExitPoint(street, cafe.initialPlayerPosition)
    const crossScene = classifyMainlineWorldCommand(cafe, cafe.initialPlayerPosition, streetTarget)
    expect(crossScene).toMatchObject({ kind: 'passage', passage: { id: street.id }, requestedTarget: streetTarget })

    const eatery = mainlineScenes['yonghe-eatery']
    const locked = eatery.passages.find((passage) => passage.id === 'yonghe-back-door')!
    const lockedTarget = mainlinePassageExitPoint(locked, eatery.initialPlayerPosition)
    const lockedPlan = classifyMainlineWorldCommand(eatery, eatery.initialPlayerPosition, lockedTarget)
    expect(lockedPlan).toMatchObject({ kind: 'passage', passage: { id: locked.id }, requestedTarget: lockedTarget })
  })

  it('limits storefront passage intent to the clicked storefront slot, not its entire parent wall', () => {
    const perimeter = mainlineScenes['yonghe-mining-perimeter']
    const entrance = perimeter.passages.find((passage) => passage.id === 'yonghe-street-entry')!
    const storefront = perimeter.storefronts.find((candidate) => candidate.portalId === entrance.portalId)!
    const sourceThreshold = entrance.thresholds[0]
    const slotSpan = storefront.end - storefront.start
    const outsideSlot = { x: sourceThreshold.x, y: storefront.end + slotSpan }
    const insideSlot = { x: sourceThreshold.x, y: (storefront.start + storefront.end) / 2 }

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
