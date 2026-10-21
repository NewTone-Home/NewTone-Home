import { currentCafeStart, currentCafeOptions, currentCafeRoom } from './helpers/currentCafe'
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
  const dot = mainlineProtagonistDotFootprint(currentCafeStart,currentCafeOptions.screenMetrics)
  const protagonistOptions = { ...currentCafeOptions, actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height } }

  function pilotGeometry() {
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, currentCafeStart)
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

  it('derives impassable six-pixel gaps from every visible Cafe table-chair pair without hidden relation barriers', () => {
 const snapshot=createMainlineSceneGeometrySnapshot(cafe,currentCafeStart,{},currentCafeOptions.screenMetrics)
 const seats=cafe.objects.filter(o=>o.roomId===currentCafeRoom.id&&o.seat)
 expect(seats).toHaveLength(8)
 for(const seat of seats){
  const chair=snapshot.objects.get(seat.id)!,table=snapshot.objects.get(seat.seat!.tableId)!
  const gap=Math.abs(chair.position.y-table.position.y)-(chair.collision!.height+table.collision!.height)/2
  expect(gap*10.8).toBeCloseTo(6,3)
  const center={x:table.position.x,y:(chair.position.y+table.position.y)/2}
  for(const size of [11,16])expect(isWalkableMainlinePoint(center,cafe,{}, {...protagonistOptions,actorFootprint:{width:size/19.2,height:size/10.8}})).toBe(false)
 }
 expect(mainlineNavigationBarriers(cafe).filter(b=>seats.some(s=>b.id===s.id+'-table-barrier'))).toHaveLength(0)
})

  it('blocks direct table-chair crossings by real character bodies for protagonists and NPCs, while shared routes detour', () => {
 const {table,topChair}=pilotGeometry(),y=(table.position.y+topChair.position.y)/2
 const left={x:table.collision!.x-2*dot.width,y},right={x:table.collision!.x+table.collision!.width+2*dot.width,y}
 expect(isWalkableMainlinePoint(left,cafe,{},protagonistOptions)).toBe(true)
 expect(isWalkableMainlinePoint(right,cafe,{},protagonistOptions)).toBe(true)
 for(const size of [11,16])expect(canTravelAlongMainlineSegment(left,right,cafe,{}, {...protagonistOptions,actorFootprint:{width:size/19.2,height:size/10.8}})).toBe(false)
 const route=findMainlinePath(left,right,cafe,{},protagonistOptions)
 expect(route).not.toBeNull();expect(route!.length).toBeGreaterThan(2)
 for(let i=1;i<route!.length;i++)expect(canTravelAlongMainlineSegment(route![i-1],route![i],cafe,{},protagonistOptions)).toBe(true)
 const controller=createFreeRoamController(left);let blocked=false
 controller.moveAlong([right],undefined,{maxSpeed:100,canOccupy:p=>isWalkableMainlinePoint(p,cafe,{},protagonistOptions),canTraverse:(a,b)=>canTravelAlongMainlineSegment(a,b,cafe,{},protagonistOptions),onBlocked:()=>{blocked=true}})
 controller.tick(100);expect(blocked).toBe(true)
})

  it('keeps four chair edge contacts and lets route legality choose an accessible side instead of a seat-side rule', () => {
    const { table } = pilotGeometry()
    const candidates = mainlineEntityInteractionCandidates(cafe, pilotBottomChairId, currentCafeStart, {}, protagonistOptions.actorFootprint, protagonistOptions)
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

  it('checks every current two-seat group using its exact visible object body and both reachable chairs', () => {
 const groups=cafe.furnitureGroups.filter(g=>g.entityIds.some(id=>cafe.objects.find(o=>o.id===id)?.roomId===currentCafeRoom.id))
 expect(groups).toHaveLength(4)
 const snapshot=createMainlineSceneGeometrySnapshot(cafe,currentCafeStart,{},currentCafeOptions.screenMetrics)
 for(const group of groups){
  const objects=group.entityIds.map(id=>cafe.objects.find(o=>o.id===id)!),tables=objects.filter(o=>o.kind==='table'),seats=objects.filter(o=>o.seat)
  expect(tables).toHaveLength(1);expect(seats).toHaveLength(2)
  for(const object of objects)expect(snapshot.objects.get(object.id)!.collision).toEqual(mainlineEntityTextFootprint(object,object.position,currentCafeOptions.screenMetrics))
  for(const seat of seats)expect(findMainlinePathToEntity(cafe,seat.id,currentCafeStart,{},protagonistOptions).path,seat.id).not.toBeNull()
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
    const route = findMainlinePathToEntity(cafe, 'commercial-cafe-plant-lower', currentCafeStart, {}, protagonistOptions).path

    expect(route).not.toBeNull()
    expectPreparedRouteToBeLiveLegal(cafe, currentCafeStart, route!)
  })

  it('still removes a redundant waypoint when its shortcut is live-legal', () => {
    const start = currentCafeStart
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
