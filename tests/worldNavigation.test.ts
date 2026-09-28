import { describe, expect, it } from 'vitest'
import { createPolygonNavigationMesh } from '../src/center/runtime/scenePathfinding'
import { canActorReachPassageApproach, canTravelAlongMainlineSegment, classifyMainlineWorldCommand, findMainlineRoomPassageSequence, mainlineNavigationCollisionBoxes, mainlinePassageDoorwayForNavigation, mainlinePassageExitPoint, resolveMainlineNpcPosition, resolveMainlineWorldNavigation } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'

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
    const allowed = resolveMainlineWorldNavigation(cafe, cafe.initialPlayerPosition, staffTarget, {}, { actorId: 'server' })!
    expect(allowed.reachedRequestedTarget).toBe(true)
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
    const serverPosition = resolveMainlineNpcPosition(cafe, 'server')

    expect(canActorReachPassageApproach(cafe, backDoor, cafe.initialPlayerPosition, {}, protagonistOptions)).toBeNull()
    expect(serverPosition).toBeDefined()
    expect(canActorReachPassageApproach(cafe, backDoor, serverPosition!, {}, { actorId: 'server' })).not.toBeNull()

    const backDoorTarget = mainlinePassageExitPoint(backDoor, cafe.initialPlayerPosition)
    expect(classifyMainlineWorldCommand(cafe, cafe.initialPlayerPosition, backDoorTarget, {}, protagonistOptions)).toMatchObject({ kind: 'ordinary' })
    expect(classifyMainlineWorldCommand(cafe, serverPosition!, backDoorTarget, {}, { actorId: 'server' })).toMatchObject({ kind: 'passage', passage: { id: backDoor.id } })
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
