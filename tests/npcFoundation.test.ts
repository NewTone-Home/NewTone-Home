import { currentCafeStart, currentCafeOptions, currentCafeRoom, cafePoint } from './helpers/currentCafe'
import { describe, expect, it } from 'vitest'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { findMainlinePath, findMainlinePathToEntity, findMainlinePathToNpc, isMainlineNavigationBarrierClear, isWalkableMainlinePoint, mainlineInteractionTarget, mainlineNavigationBarriers, mainlineNavigationCollisionBoxes, mainlineNpcInteractionTarget, resolveMainlineNpcPosition, resolveMainlineWorldNavigation } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineSceneOccupiedSeatIds } from '../src/center/runtime/mainlineSeating'
import { mainlineNpcStagedSeatId, mainlineNpcStagingBehavior } from '../src/center/runtime/mainlineNpcStaging'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'
import { mainlineLabelFootprint, mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId } from '../src/center/runtime/commercialCafeStory'

describe('static NPC foundation', () => {
  const cafe = mainlineScenes['commercial-cafe']
  const laoZhou = cafe.npcs.find((npc) => npc.id === 'lao-zhou')!
  const coffeeOwner = cafe.npcs.find((npc) => npc.id === commercialCafeCoffeeOwnerNpcId)!
  const floorServer = cafe.npcs.find((npc) => npc.id === commercialCafeFloorServerNpcId)!

  it('keeps Lao Zhou identity separate from behavior-derived scene seating', () => {
    const behavior = mainlineNpcStagingBehavior(cafe, laoZhou.id)
    const seat = cafe.objects.find((entity) => entity.id === mainlineNpcStagedSeatId(cafe, laoZhou.id))

    expect(laoZhou).not.toHaveProperty('seatEntityId')
    expect(cafe.npcPlacements.filter(p => [laoZhou.id, coffeeOwner.id, floorServer.id].includes(p.npcId))).toEqual([])
    expect(behavior).toEqual({ npcId: 'lao-zhou', dutyId: 'lao-zhou.seated', targetId: 'commercial-cafe-right-window-upper-group-chair-top', targetKind: 'seat' })
    expect(seat).toMatchObject({
      id: 'commercial-cafe-right-window-upper-group-chair-top',
      kind: 'seat',
      seat: expect.objectContaining({ sit: expect.any(Object) }),
    })
    expect(resolveMainlineNpcPosition(cafe, laoZhou.id)).toEqual(seat?.position)
    expect(mainlineSceneOccupiedSeatIds(cafe)).toEqual(new Set([seat?.id]))
  })

  it('keeps NPCs out of spatial entities and approaches Lao Zhou as a person, not as his story table', () => {
    const laoZhouPosition = resolveMainlineNpcPosition(cafe, laoZhou.id)
    const coffeeOwnerPosition = resolveMainlineNpcPosition(cafe, coffeeOwner.id)
    const floorServerPosition = resolveMainlineNpcPosition(cafe, floorServer.id)
    const from = currentCafeStart
    const laoZhouTarget = mainlineNpcInteractionTarget(cafe, laoZhou.id, from)
    const coffeeOwnerTarget = mainlineNpcInteractionTarget(cafe, coffeeOwner.id, from)
    const floorServerTarget = mainlineNpcInteractionTarget(cafe, floorServer.id, from)

    expect(cafe.objects.some((entity) => [laoZhou.id, coffeeOwner.id, floorServer.id].includes(entity.id))).toBe(false)
    expect(laoZhouTarget).not.toEqual(laoZhouPosition)
    expect(coffeeOwnerTarget).not.toEqual(coffeeOwnerPosition)
    expect(floorServerTarget).not.toEqual(floorServerPosition)
    const laoZhouBox = mainlineLabelFootprint(laoZhou.label, laoZhouPosition, currentCafeOptions.screenMetrics, { lineHeight: 1 })
    expect(laoZhouTarget.x < laoZhouBox.x || laoZhouTarget.x > laoZhouBox.x+laoZhouBox.width || laoZhouTarget.y < laoZhouBox.y || laoZhouTarget.y > laoZhouBox.y+laoZhouBox.height).toBe(true)
    expect(laoZhouTarget).not.toEqual(mainlineInteractionTarget(cafe, laoZhou.interactionTargetEntityId, from))
    expect(findMainlinePathToNpc(cafe, laoZhou.id, from).path).not.toBeNull()
  })

  it('keeps the coffee owner clickable through a dynamic customer-side counter contact', () => {
    const counter = cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter')!
    const counterBody = cafe.continuousStructures.find((structure) => structure.id === counter.interactionStructureId)!
    const target = mainlineNpcInteractionTarget(cafe, coffeeOwner.id, currentCafeStart)
    const route = findMainlinePathToNpc(cafe, coffeeOwner.id, currentCafeStart)

    expect(target.x).toBeGreaterThan(counterBody.x + counterBody.width)
    expect(isWalkableMainlinePoint(target, cafe)).toBe(true)
    expect(route.path).not.toBeNull()
  })

  it('uses one navigation runtime so NPCs block the protagonist but never themselves', () => {
    const runtime = createNavigationRuntime()
    const laoZhouPosition = resolveMainlineNpcPosition(cafe, laoZhou.id)
    const coffeeOwnerPosition = resolveMainlineNpcPosition(cafe, coffeeOwner.id)
    const floorServerPosition = resolveMainlineNpcPosition(cafe, floorServer.id)
    const protagonistBox = mainlineProtagonistDotFootprint(currentCafeStart,currentCafeOptions.screenMetrics)
    const laoZhouBox = mainlineLabelFootprint(laoZhou.label, laoZhouPosition, undefined, { lineHeight: 1 })
    const coffeeOwnerBox = mainlineLabelFootprint(coffeeOwner.label, coffeeOwnerPosition, currentCafeOptions.screenMetrics, { lineHeight: 1 })
    const floorServerBox = mainlineLabelFootprint(floorServer.label, floorServerPosition, currentCafeOptions.screenMetrics, { lineHeight: 1 })
    runtime.registerActor('protagonist', currentCafeStart, { width: protagonistBox.width, height: protagonistBox.height })
    runtime.registerActor(laoZhou.id, laoZhouPosition, { width: laoZhouBox.width, height: laoZhouBox.height })
    runtime.registerActor(coffeeOwner.id, coffeeOwnerPosition, { width: coffeeOwnerBox.width, height: coffeeOwnerBox.height })
    runtime.registerActor(floorServer.id, floorServerPosition, { width: floorServerBox.width, height: floorServerBox.height })
    const options = { ...currentCafeOptions, navigationRuntime: runtime, actorId: 'protagonist' as const }
    const target = mainlineNpcInteractionTarget(cafe, laoZhou.id, currentCafeStart, {}, undefined, options)
    const path = findMainlinePath(currentCafeStart, target, cafe, {}, options)

    expect(runtime.dynamicObstaclesFor('protagonist')).toHaveLength(3)
    expect(runtime.dynamicObstaclesFor('protagonist').some((box) => box.x === currentCafeStart.x - protagonistBox.width / 2 && box.y === currentCafeStart.y - protagonistBox.height / 2)).toBe(false)
    expect(isWalkableMainlinePoint(laoZhouPosition, cafe, {}, options)).toBe(false)
    expect(isWalkableMainlinePoint(coffeeOwnerPosition, cafe, {}, options)).toBe(false)
    expect(isWalkableMainlinePoint(floorServerPosition, cafe, {}, options)).toBe(false)
    expect(isWalkableMainlinePoint(target, cafe, {}, options)).toBe(true)
    expect(path).not.toBeNull()
    expect(path?.every((point) => isWalkableMainlinePoint(point, cafe, {}, options))).toBe(true)
  })

  it('keeps all three visible counter runs continuous and preserves the original coffee-order identity without phantom order cells', () => {
 const counters=cafe.objects.filter(o=>o.roomId===currentCafeRoom.id&&o.interactionStructureId?.startsWith('cafe-trial-counter-'))
 const bodies=cafe.continuousStructures.filter(b=>b.id.startsWith('cafe-trial-counter-'))
 expect(counters).toHaveLength(39);expect(bodies).toHaveLength(3)
 expect(counters.filter(o=>o.interactionBehavior==='cafe-order').map(o=>o.id)).toEqual(['commercial-cafe-counter'])
 const snapshot=createMainlineSceneGeometrySnapshot(cafe,currentCafeStart,{},currentCafeOptions.screenMetrics)
 for(const counter of counters){
  const body=bodies.find(b=>b.id===counter.interactionStructureId)!
  expect(body).toBeDefined()
  expect(snapshot.objects.get(counter.id)!.collision).toBeNull()
  expect(counter.position.x).toBeGreaterThanOrEqual(body.x)
  expect(counter.position.x).toBeLessThanOrEqual(body.x+body.width)
  expect(counter.position.y).toBeGreaterThanOrEqual(body.y)
  expect(counter.position.y).toBeLessThanOrEqual(body.y+body.height)
 }
 for(const body of bodies)expect(mainlineNavigationCollisionBoxes(cafe,{},currentCafeOptions).filter(b=>b.x===body.x&&b.y===body.y&&b.width===body.width&&b.height===body.height)).toHaveLength(1)
 const target=mainlineInteractionTarget(cafe,'commercial-cafe-counter',currentCafeStart,{},undefined,currentCafeOptions)
 expect(isWalkableMainlinePoint(target,cafe,{},currentCafeOptions)).toBe(true)
 expect(findMainlinePath(currentCafeStart,target,cafe,{},currentCafeOptions)).not.toBeNull()
})

  it('keeps the Cafe staff region actor-specific without inventing an invisible furniture body',()=>{
 const staff=cafe.accessRegions.find(r=>r.id==='commercial-cafe-staff-area')!
 const owner=resolveMainlineNpcPosition(cafe,coffeeOwner.id),floor=resolveMainlineNpcPosition(cafe,floorServer.id)
 expect(staff.requiredAccess).toBe('staff');expect(staff.deniedText).toBeTruthy()
 expect(cafe.actorAccess.protagonist).toEqual(['public']);expect(cafe.actorAccess['lao-zhou']).toEqual(['public'])
 expect(cafe.actorAccess[coffeeOwner.id]).toEqual(['public','staff']);expect(cafe.actorAccess[floorServer.id]).toEqual(['public'])
 expect(isWalkableMainlinePoint(owner,cafe,{}, {...currentCafeOptions,actorId:coffeeOwner.id})).toBe(true)
 expect(isWalkableMainlinePoint(owner,cafe,{},currentCafeOptions)).toBe(false)
 expect(isWalkableMainlinePoint(floor,cafe,{}, {...currentCafeOptions,actorId:floorServer.id})).toBe(true)
 for(const actorId of ['protagonist',coffeeOwner.id])expect(mainlineNavigationCollisionBoxes(cafe,{}, {...currentCafeOptions,actorId}).some(b=>b.x===staff.x&&b.y===staff.y&&b.width===staff.width&&b.height===staff.height)).toBe(false)
 const publicPoint={x:staff.x+staff.width/2,y:staff.y+staff.height+3},staffPoint={...publicPoint,y:staff.y+staff.height-3}
 expect(findMainlinePath(publicPoint,staffPoint,cafe,{},currentCafeOptions)).toBeNull()
 expect(findMainlinePath(publicPoint,staffPoint,cafe,{}, {...currentCafeOptions,actorId:coffeeOwner.id})).not.toBeNull()
})

  // APPROVED CONTRACT MIGRATION: replaces the retired portal/frontier-sampling
  // contract. Replacement evidence: this test verifies three preserved raw staff
  // requests and actor-specific component resolution; fixedInteractionAccess.test.ts
  // verifies the shared boundary for planning/travel; commercial-cafe.spec.ts
  // verifies that the player-visible marker stays at the raw request.
  it('APPROVED CONTRACT MIGRATION: resolves denied staff clicks on the current public component without portal sampling', () => {
    const staffArea = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const coffeeOwnerPosition = resolveMainlineNpcPosition(cafe, coffeeOwner.id)
    const floorServerPosition = resolveMainlineNpcPosition(cafe, floorServer.id)
    const customerPoint = cafe.objects.find((entity) => entity.id === 'cafe-trial-table-group-2-table')!.approach!
    const requestedTargets = [
      { x: staffArea.x + staffArea.width * .2, y: staffArea.y + staffArea.height * .25 },
      { x: staffArea.x + staffArea.width * .5, y: staffArea.y + staffArea.height * .5 },
      { x: staffArea.x + staffArea.width * .8, y: staffArea.y + staffArea.height * .75 },
    ]
    const denied = requestedTargets.map((requestedTarget) => (
      resolveMainlineWorldNavigation(cafe, currentCafeStart, requestedTarget, {}, { ...currentCafeOptions, actorId: 'protagonist' })!
    ))
    const floorServerDenied = resolveMainlineWorldNavigation(cafe, floorServerPosition, requestedTargets[1]!, {}, { ...currentCafeOptions, actorId: floorServer.id })!

    expect(denied.map((resolution) => resolution.requestedTarget)).toEqual(requestedTargets)
    expect(floorServerDenied.reachedRequestedTarget).toBe(false)
    expect(floorServerDenied.deniedAccessRegion?.id).toBe(staffArea.id)
    expect(new Set(denied.map((resolution) => `${resolution.requestedTarget.x}:${resolution.requestedTarget.y}`)).size).toBe(requestedTargets.length)
    for (const resolution of denied) {
      expect(resolution.reachedRequestedTarget).toBe(false)
      expect(resolution.deniedAccessRegion?.id).toBe(staffArea.id)
      expect(isWalkableMainlinePoint(resolution.resolvedNavigableTarget, cafe, {}, { ...currentCafeOptions, actorId: 'protagonist' })).toBe(true)
      expect(resolution.path.length).toBeGreaterThan(1)
      for (let pointIndex = 1; pointIndex < resolution.path.length; pointIndex += 1) {
        expect(isMainlineNavigationBarrierClear(resolution.path[pointIndex - 1]!, resolution.path[pointIndex]!, cafe, {}, { ...currentCafeOptions, actorId: 'protagonist' })).toBe(true)
      }
      expect(findMainlinePath(currentCafeStart, resolution.requestedTarget, cafe, {}, { ...currentCafeOptions, actorId: 'protagonist' })).toBeNull()
    }

    const serverResolution = resolveMainlineWorldNavigation(cafe, coffeeOwnerPosition, requestedTargets[1]!, {}, { ...currentCafeOptions, actorId: coffeeOwner.id })!
    expect(serverResolution.reachedRequestedTarget).toBe(true)
    expect(serverResolution.resolvedNavigableTarget).toEqual(requestedTargets[1])

    const outbound = findMainlinePath(coffeeOwnerPosition, customerPoint, cafe, {}, { ...currentCafeOptions, actorId: coffeeOwner.id })
    const returnPath = findMainlinePath(customerPoint, coffeeOwnerPosition, cafe, {}, { ...currentCafeOptions, actorId: coffeeOwner.id })
    expect(outbound).not.toBeNull()
    expect(returnPath).not.toBeNull()
    expect(outbound?.every((point) => isWalkableMainlinePoint(point, cafe, {}, { ...currentCafeOptions, actorId: coffeeOwner.id }))).toBe(true)
    expect(returnPath?.every((point) => isWalkableMainlinePoint(point, cafe, {}, { ...currentCafeOptions, actorId: coffeeOwner.id }))).toBe(true)
    const counterBody = cafe.continuousStructures.find((structure) => structure.id === 'cafe-trial-counter-long-body')!
    const counterRight = counterBody.x + counterBody.width
    expect(outbound?.some((point) => point.x > counterRight)).toBe(true)
    expect(returnPath?.some((point) => point.x > counterRight)).toBe(true)
  })

  it('uses table body edges instead of an authored table approach for ordinary interaction', () => {
    const table = cafe.objects.find((entity) => entity.id === 'cafe-trial-table-group-2-table')!
    const fromLeft = { x: table.position.x - 2, y: table.position.y }
    const fromRight = { x: table.position.x + 2, y: table.position.y }
    const leftTarget = mainlineInteractionTarget(cafe, table.id, fromLeft)
    const rightTarget = mainlineInteractionTarget(cafe, table.id, fromRight)
    const renderedTableCollision = createMainlineSceneGeometrySnapshot(cafe, currentCafeStart).objects.get(table.id)!.collision!

    expect(leftTarget.x).toBeLessThan(renderedTableCollision.x)
    expect(rightTarget.x).toBeGreaterThan(renderedTableCollision.x + renderedTableCollision.width)
    expect(leftTarget).not.toEqual(table.approach)
    expect(rightTarget).not.toEqual(table.approach)
    expect(findMainlinePathToEntity(cafe, table.id, fromLeft).path).not.toBeNull()
    expect(findMainlinePathToEntity(cafe, table.id, fromRight).path).not.toBeNull()
  })

  it('replaces an unfinished NPC approach before its prior arrival callback can fire', () => {
    const start = currentCafeStart
    const actorStep = 4
    const controller = createFreeRoamController(start)
    const arrivals: string[] = []

    controller.moveAlong([{ x: start.x + actorStep, y: start.y }], () => arrivals.push('lao-zhou'), { maxSpeed: 1 })
    controller.moveAlong([{ x: start.x, y: start.y + actorStep }], () => arrivals.push(commercialCafeCoffeeOwnerNpcId), { maxSpeed: 1 })
    controller.tick(1000)
    controller.tick(2000)
    controller.tick(3000)
    controller.tick(4000)
    controller.tick(5000)

    expect(arrivals).toEqual([commercialCafeCoffeeOwnerNpcId])
  })
})
