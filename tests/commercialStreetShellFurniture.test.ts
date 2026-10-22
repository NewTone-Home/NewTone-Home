import { currentCafeStart, currentCafeOptions, currentCafeRoom, cafePoint } from './helpers/currentCafe'
import { resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { describe, expect, it } from 'vitest'
import { mainlineEntityBelongsToActiveRoom, type MainlineSceneEntity } from '../src/center/runtime/mainlineSceneModel'
import { commercialCafeLaoZhouConversationSeatId, commercialCafeStoryTableId } from '../src/center/runtime/commercialCafeStory'
import { canTravelAlongMainlineSegment, findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint, resolveMainlineSeatSitPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineSceneGeometryUnits, mainlineScenes, mainlineStorefrontApproach, validateMainlineSceneGeometry } from '../src/center/runtime/mainlineScenes'
import { boundaryGridStepsFromReferenceSpacing, sceneDesignReferenceMetrics, sharedFurnitureGlyphSpacingPx } from '../src/center/runtime/sceneBoundaryGrid'

const street = mainlineScenes['commercial-street']
const sampleRoomIds = ['commercial-south-s5-interior', 'commercial-south-s2-interior'] as const
const northCafeRoomId = 'commercial-north-cafe-interior'
const steps = boundaryGridStepsFromReferenceSpacing()
const glyphSteps = boundaryGridStepsFromReferenceSpacing(sharedFurnitureGlyphSpacingPx)

function localCell(roomId: string, point: { x: number; y: number }) {
  const room = street.rooms.find((candidate) => candidate.id === roomId)!
  return {
    column: (point.x - room.bounds.x) / steps.horizontal - 1,
    row: (point.y - room.bounds.y) / steps.vertical,
  }
}

function northCafeCell(column: number, row: number) {
  const room = street.rooms.find((candidate) => candidate.id === northCafeRoomId)!
  return { x: room.bounds.x + (column + 1) * steps.horizontal, y: room.bounds.y + room.bounds.height - row * steps.vertical }
}

function northCafeLocalCell(point: { x: number; y: number }) {
  const room = street.rooms.find((candidate) => candidate.id === northCafeRoomId)!
  return {
    // Furniture is translated without stretching its 16px internal geometry;
    // the former rounded wall pitch contributes <.02 reference px here.
    column: Number(((point.x - room.bounds.x) / steps.horizontal - 1).toFixed(3)),
    row: Number(((room.bounds.y + room.bounds.height - point.y) / steps.vertical).toFixed(3)),
  }
}

function overlaps(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y
}

function shellInside(slotId:string){const slot=street.storefronts.find(s=>s.id===slotId)!;return street.passages.find(p=>p.portalId===slot.portalId)!.crossingTargets[0]}
const referenceOptions={screenMetrics:sceneDesignReferenceMetrics,actorId:'protagonist',actorFootprint:{width:11/19.2,height:11/10.8}}

describe('commercial street shell furniture samples', () => {
  it('keeps one 24-by-25-interval Cafe shell and moves original story identities into that live room',()=>{
 const shell=currentCafeRoom,slot=street.storefronts.find(s=>s.id==='commercial-cafe-slot')!
 expect(shell.bounds.width*19.2).toBeCloseTo(672,3);expect(shell.bounds.height*10.8).toBeCloseTo(700,3)
 expect(slot.composition?.baseline).toHaveLength(23);expect(slot.composition?.near).toHaveLength(23)
 expect(mainlineScenes['commercial-cafe']).toBe(street)
 expect(street.objects.find(o=>o.id===commercialCafeStoryTableId)?.roomId).toBe(shell.id)
 expect(street.objects.find(o=>o.id===commercialCafeLaoZhouConversationSeatId)?.seat?.tableId).toBe(commercialCafeStoryTableId)
 expect(street.npcs.find(n=>n.id==='lao-zhou')?.roomId).toBe(shell.id)
 expect(street.structures.some(w=>w.id==='commercial-cafe-room')).toBe(false)
 expect(street.passages.find(p=>p.id==='street-cafe-entry')).toMatchObject({access:'open',routeThrough:true,toRoomId:shell.id})
 expect(street.passages.find(p=>p.id===shell.id+'-rear-door')?.access).toBe('locked')
})

  it('places four two-seat groups in the approved right-side trial positions with eight distinct seat IDs',()=>{
 const tables=street.objects.filter(o=>o.roomId===northCafeRoomId&&o.kind==='table'),seats=street.objects.filter(o=>o.roomId===northCafeRoomId&&o.seat)
 expect(tables.map(t=>t.position)).toEqual([[448,196],[588,196],[448,448],[588,448]].map(([x,y])=>cafePoint(x,y)))
 expect(seats).toHaveLength(8);expect(new Set(seats.map(s=>s.id)).size).toBe(8)
 for(const table of tables)expect(seats.filter(s=>s.seat!.tableId===table.id)).toHaveLength(2)
 expect(seats.some(s=>s.id===commercialCafeLaoZhouConversationSeatId)).toBe(true)
 expect(street.furnitureGroups.filter(g=>tables.some(t=>t.groupId===g.id))).toHaveLength(4)
})

  it('keeps the three 16px Cafe counter runs, distinct service markers and real employee opening without an interior storage label',()=>{
 const bodies=street.continuousStructures.filter(b=>b.id.startsWith('cafe-trial-counter-'))
 expect(bodies).toHaveLength(3)
 const cells=street.objects.filter(o=>bodies.some(b=>o.interactionStructureId===b.id));expect(cells).toHaveLength(38)
 expect(new Set(cells.map(o=>o.position.x+':'+o.position.y)).size).toBe(38)
 for(const body of bodies){
  const run=cells.filter(o=>o.interactionStructureId===body.id)
  expect(Math.min(...run.map(c=>c.position.x))-8/19.2).toBeCloseTo(body.x,5)
  expect(Math.max(...run.map(c=>c.position.x))+8/19.2).toBeCloseTo(body.x+body.width,5)
  expect(Math.min(...run.map(c=>c.position.y))-8/10.8).toBeCloseTo(body.y,5)
  expect(Math.max(...run.map(c=>c.position.y))+8/10.8).toBeCloseTo(body.y+body.height,5)
  for(const c of run)expect(Array.from(c.label)).toHaveLength(1)
  for(let i=0;i<run.length;i+=2){expect(run.slice(i,i+2).map(c=>c.label).join('')).toBe('柜台');expect(Math.hypot((run[i+1].position.x-run[i].position.x)*19.2,(run[i+1].position.y-run[i].position.y)*10.8)).toBeCloseTo(16,5)}
 }
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)expect(overlaps(bodies[i],bodies[j])).toBe(false)
 for(const id of ['commercial-cafe-menu','cafe-trial-order','cafe-trial-pickup'])expect(street.objects.find(o=>o.id===id)?.roomId).toBe(northCafeRoomId)
 expect(street.objects.some(o=>o.roomId===northCafeRoomId&&(o.id.includes('storage')||o.id.includes('staff-opening')))).toBe(false)
 expect(street.passages.find(p=>p.id==='cafe-trial-customer-toilet-door')?.access).toBe('locked')
 const region=street.accessRegions.find(r=>r.id==='commercial-cafe-staff-area')!,lower=cafePoint(228,56),inside=cafePoint(164,56)
 expect(isWalkableMainlinePoint(lower,street,{},referenceOptions)).toBe(true)
 expect(findMainlinePath(lower,inside,street,{},referenceOptions)).toBeNull()
 expect(findMainlinePath(lower,inside,street,{}, {...referenceOptions,actorId:'cafe-coffee-owner'})).not.toBeNull()
})

  it('reaches every Cafe chair from the public doorway and reserves the locked warehouse approach for staff',()=>{
 const seats=street.objects.filter(o=>o.roomId===northCafeRoomId&&o.seat),rear=street.passages.find(p=>p.id===northCafeRoomId+'-rear-door')!
 expect(seats).toHaveLength(8);expect(rear.access).toBe('locked')
 for(const seat of seats){expect(findMainlinePathToEntity(street,seat.id,currentCafeStart,{},currentCafeOptions).path,seat.id).not.toBeNull();expect(resolveMainlineSeatSitPosition(street,seat.id)).not.toBeNull()}
 expect(findMainlinePath(currentCafeStart,rear.thresholds[0],street,{},currentCafeOptions)).toBeNull()
 const staff={...currentCafeOptions,actorId:'cafe-coffee-owner'}
 expect(findMainlinePath(resolveMainlineNpcPosition(street,'cafe-coffee-owner'),rear.thresholds[0],street,{},staff)).not.toBeNull()
})

  it('keeps the existing milk-tea and fast-food furnishings scoped to their shells', () => {
    const scoped = street.objects.filter((entity) => sampleRoomIds.includes(entity.roomId as typeof sampleRoomIds[number]))
    expect(new Set(scoped.map((entity) => entity.roomId))).toEqual(new Set(sampleRoomIds))
    expect(scoped.every((entity) => entity.visible !== false)).toBe(true)

    const milkTeaTables = scoped.filter((entity) => entity.roomId === sampleRoomIds[0] && entity.kind === 'table')
    const fastFoodTables = scoped.filter((entity) => entity.roomId === sampleRoomIds[1] && entity.kind === 'table')
    expect(milkTeaTables).toHaveLength(0)
    expect(fastFoodTables).toHaveLength(2)
    expect(street.furnitureGroups.filter(g=>g.id.startsWith('commercial-s2-fast-food-')).map(g=>g.id)).toEqual(['commercial-s2-fast-food-table-group-a','commercial-s2-fast-food-table-group-b'])
    expect(street.furnitureGroups.some(g=>g.id==='commercial-s5-milk-tea-table-group')).toBe(false)
    for (const entity of scoped.filter((candidate) => candidate.kind === 'table' || candidate.kind === 'seat')) {
      const local = localCell(entity.roomId!, entity.position)
      if (entity.roomId === sampleRoomIds[0]) {
        expect(local.column).toBeGreaterThanOrEqual(1.8)
        expect(local.column).toBeLessThanOrEqual(5.2)
        expect(local.row).toBeGreaterThanOrEqual(4)
        expect(local.row).toBeLessThanOrEqual(15)
      } else {
        expect(local.column).toBeGreaterThanOrEqual(2)
        expect(local.column).toBeLessThanOrEqual(13)
        expect(local.row).toBeGreaterThanOrEqual(3)
        expect(local.row).toBeLessThanOrEqual(15)
      }
    }

    const unscoped = { id: 'ordinary-store-fixture', label: '窗', kind: 'fixture', weight: 'fixture', surface: 'floor', position: { x: 0, y: 0 } } as MainlineSceneEntity
    expect(mainlineEntityBelongsToActiveRoom(unscoped, undefined)).toBe(true)
    expect(mainlineEntityBelongsToActiveRoom(scoped[0], scoped[0].roomId)).toBe(true)
    expect(mainlineEntityBelongsToActiveRoom(scoped.find(o=>o.roomId===sampleRoomIds[0])!, sampleRoomIds[1])).toBe(false)
    expect(mainlineEntityBelongsToActiveRoom(scoped[0], undefined)).toBe(false)
  })

  it('keeps the 13x26 milk-tea and 25x26 fast-food shells and both front/rear access states', () => {
    const steps = boundaryGridStepsFromReferenceSpacing()
    for (const [roomId, columns] of [[sampleRoomIds[0], 11], [sampleRoomIds[1], 23]] as const) {
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      expect(room.bounds.width).toBeCloseTo(steps.horizontal * (columns + 1))
      expect(room.bounds.height).toBeCloseTo(steps.vertical * 25)
      const slotNumber = roomId.includes('-s5-') ? '5' : '2'
      const storefront = street.storefronts.find((candidate) => candidate.id === `commercial-south-slot-${slotNumber}`)!
      const front = street.passages.find((candidate) => candidate.portalId === storefront.portalId)!
      const rear = street.passages.find((candidate) => candidate.id === `${roomId}-rear-door`)!
      expect(front.access).toBe('open')
      expect(front.routeThrough).toBe(true)
      expect(front.toRoomId).toBe(roomId)
      expect(rear.access).toBe('locked')
    }
  })

  it('reserves the enclosed milk rear approach for staff and retains fast-food partition access', () => {
    for (const roomId of sampleRoomIds) {
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      const rear = street.passages.find((candidate) => candidate.id === `${roomId}-rear-door`)!
      const interior = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
      const publicRoute=findMainlinePath(interior,rear.thresholds[0],street,{},referenceOptions)
      expect(rear.access).toBe('locked')
      if(roomId===sampleRoomIds[0]) {
        expect(publicRoute).toBeNull()
        const actorId='milk-tea-trial-worker',worker=resolveMainlineNpcPosition(street,actorId)
        expect(findMainlinePath(worker,rear.thresholds[0],street,{}, {...referenceOptions,actorId,actorFootprint:{width:16/19.2,height:16/10.8}})).not.toBeNull()
      } else expect(publicRoute).not.toBeNull()
    }
  })

  it('keeps fast-food circulation while the milk-tea worker uses the actual right-side work line and customers stay outside it',()=>{
 const fast=street.rooms.find(r=>r.id===sampleRoomIds[1])!,target={x:fast.bounds.x+17*steps.horizontal,y:fast.bounds.y+10*steps.vertical}
 expect(findMainlinePath(shellInside('commercial-south-slot-2'),target,street,{},referenceOptions)).not.toBeNull()
 const worker=street.npcPlacements.find(n=>n.npcId==='milk-tea-trial-worker')!.position
 expect(isWalkableMainlinePoint(worker,street,{},referenceOptions)).toBe(false)
 expect(isWalkableMainlinePoint(worker,street,{}, {...referenceOptions,actorId:'milk-tea-trial-worker'})).toBe(true)
 for(const id of ['commercial-s5-milk-tea-order-service-label','commercial-s5-milk-tea-pickup-service-label'])expect(findMainlinePathToEntity(street,id,shellInside('commercial-south-slot-5'),{},referenceOptions).path).not.toBeNull()
})

  it('matches both current milk-tea counter bodies to their unique 16px glyph union and retains the fast-food counter',()=>{
 const milkBodies=street.continuousStructures.filter(b=>b.id.startsWith('milk-tea-trial-'))
 expect(milkBodies).toHaveLength(2)
 let total=0
 for(const body of milkBodies){const cells=street.objects.filter(o=>o.interactionStructureId===body.id);total+=cells.length;expect(cells.length).toBeGreaterThan(1)
  expect(Math.min(...cells.map(c=>c.position.x))-8/19.2).toBeCloseTo(body.x,5)
  expect(Math.max(...cells.map(c=>c.position.x))+8/19.2).toBeCloseTo(body.x+body.width,5)
  expect(Math.min(...cells.map(c=>c.position.y))-8/10.8).toBeCloseTo(body.y,5)
  expect(Math.max(...cells.map(c=>c.position.y))+8/10.8).toBeCloseTo(body.y+body.height,5)
  for(let i=0;i<cells.length;i+=2){expect(cells.slice(i,i+2).map(c=>c.label).join('')).toBe('柜台');expect(Math.hypot((cells[i+1].position.x-cells[i].position.x)*19.2,(cells[i+1].position.y-cells[i].position.y)*10.8)).toBeCloseTo(16,4)}
 }
 expect(total).toBe(42);expect(overlaps(milkBodies[0],milkBodies[1])).toBe(false)
 const fast=street.objects.filter(o=>o.id.startsWith('commercial-s2-fast-food-counter-'))
 expect(fast).toHaveLength(10);expect(fast.every(o=>o.interactionStructureId==='commercial-s2-fast-food-counter-1-body')).toBe(true)
 expect(new Set(fast.map(o=>o.position.x)).size).toBe(1)
})

  it('keeps internal wall glyphs collidable and leaves independent warehouse/kitchen door gaps', () => {
    const walls = street.objects.filter((entity) => entity.label === '墙' && entity.roomId
      && (entity.id.startsWith('commercial-s5-milk-tea-') || entity.id.startsWith('commercial-s2-fast-food-'))
      && (entity.id.includes('rear-partition-') || entity.id.includes('divider-')))
    const internalDoors = street.objects.filter((entity) => entity.label === '门'
      && sampleRoomIds.includes(entity.roomId as typeof sampleRoomIds[number]))
    expect(walls).toHaveLength(27)
    expect(street.objects.some(o=>o.id==='commercial-s5-milk-tea-kitchen-door'||o.id==='commercial-s5-milk-tea-warehouse-door')).toBe(false)
    expect(street.continuousStructures.some(b=>b.id.startsWith('commercial-s5-milk-tea-'))).toBe(false)
    expect(internalDoors.map((entity) => entity.id).sort()).toEqual([
      'commercial-s2-fast-food-kitchen-door',
      'commercial-s2-fast-food-warehouse-door',
    ])
    expect(street.continuousStructures.filter((structure) => structure.kind === 'barrier'
      && (structure.id.includes('s5-milk-tea-') || structure.id.includes('s2-fast-food-')))).toHaveLength(4)
    expect(walls.every((wall) => !wall.collision)).toBe(true)
    expect(internalDoors.every((door) => !door.collision)).toBe(true)
    expect(street.blockers).toHaveLength(0)
    expect(validateMainlineSceneGeometry(street)).toEqual([])
  })

  it('keeps internal partition glyphs visible at the expanded shell edges without shortening collision runs', () => {
    const shellWallCells = mainlineSceneGeometryUnits(street, street.initialPlayerPosition)
      .filter((unit) => unit.sourceWallId?.endsWith('-shell'))
      .flatMap((unit) => unit.visual.cells)
      .filter((cell) => cell.kind === 'wall')
    const wallGlyphEntities = street.objects.filter((entity) => entity.roomId
      && (entity.id.includes('rear-partition-') || entity.id.includes('divider-')))
    const junctions = [
      [sampleRoomIds[1], 0, 16], [sampleRoomIds[1], 18, 16], [sampleRoomIds[1], 22, 16], [sampleRoomIds[1], 18, 21],
    ] as const

    for (const [roomId, column, row] of junctions) {
      const shellGlyphs = shellWallCells.filter((cell) => {
        const local = localCell(roomId, cell)
        return Math.abs(local.column - column) < 0.01 && Math.abs(local.row - row) < 0.01
      })
      const furnitureGlyphs = wallGlyphEntities.filter((entity) => entity.roomId === roomId
        && Math.abs(localCell(roomId, entity.position).column - column) < 0.01
        && Math.abs(localCell(roomId, entity.position).row - row) < 0.01)
      expect(shellGlyphs, `${roomId} extended shell at ${column},${row}`).toHaveLength(0)
      expect(furnitureGlyphs, `${roomId} internal partition at ${column},${row}`).toHaveLength(1)
      expect(shellGlyphs.length + furnitureGlyphs.length, `${roomId} unique wall glyph at ${column},${row}`).toBe(1)
    }

    const barriers = street.continuousStructures.filter((structure) => structure.kind === 'barrier'
      && (structure.id.includes('s5-milk-tea-') || structure.id.includes('s2-fast-food-')))
    expect(barriers).toHaveLength(4)
    for (const [id, length] of [
      ['commercial-s2-fast-food-kitchen-warehouse-divider-body', 10],
      ['commercial-s2-fast-food-rear-partition-0-body', 17],
      ['commercial-s2-fast-food-rear-partition-1-body', 2],
      ['commercial-s2-fast-food-rear-partition-2-body', 2],
    ] as const) {
      const body = barriers.find((candidate) => candidate.id === id)!
      const expected = id.includes('divider') ? length * steps.vertical : length * steps.horizontal
      expect(id.includes('divider') ? body.height : body.width, id).toBeCloseTo(expected)
    }
  })

  it('keeps rear partitions sealed except at the two marked staff door openings', () => {
    for (const [roomId, doorCols, closedCol] of [
      [sampleRoomIds[1], [16.5, 20.5], 12.5],
    ] as const) {
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      const fromFor = (column: number, row: number) => ({ x: room.bounds.x + column * steps.horizontal, y: room.bounds.y + row * steps.vertical })
      for (const doorCol of doorCols) {
        const route = findMainlinePath(fromFor(doorCol, 15), fromFor(doorCol, 17), street)
        expect(route, `${roomId}, marked staff doorway at col ${doorCol}`).not.toBeNull()
        const crossings = route!.slice(1).flatMap((point, index) => {
          const previous = route![index]!
          if ((previous.y - room.bounds.y - 16 * steps.vertical) * (point.y - room.bounds.y - 16 * steps.vertical) > 0) return []
          if (previous.y === point.y) return []
          const ratio = (room.bounds.y + 16 * steps.vertical - previous.y) / (point.y - previous.y)
          return [{ x: previous.x + ratio * (point.x - previous.x) }]
        })
        expect(crossings.length, `${roomId} must cross its back-of-house partition`).toBeGreaterThan(0)
        for (const crossing of crossings) {
          const column = (crossing.x - room.bounds.x) / steps.horizontal
          expect(doorCols.some((allowed) => Math.abs(column - allowed) <= 0.6), `${roomId} crossing at col ${column}`).toBe(true)
        }
      }
      const blockedCrossing = [fromFor(closedCol, 15.5), fromFor(closedCol, 16.5)]
      expect(canTravelAlongMainlineSegment(blockedCrossing[0], blockedCrossing[1], street), `${roomId} wall remains closed away from doors`).toBe(false)

      const dividerId = roomId === sampleRoomIds[0]
        ? 'commercial-s5-milk-tea-kitchen-divider-body'
        : 'commercial-s2-fast-food-kitchen-warehouse-divider-body'
      const divider = street.continuousStructures.find((structure) => structure.id === dividerId)!
      const localTop = (divider.y - room.bounds.y) / steps.vertical
      const localBottom = (divider.y + divider.height - room.bounds.y) / steps.vertical
      expect(localTop).toBeCloseTo(15.5)
      expect(localBottom).toBeCloseTo(25.5)
      const rear = street.passages.find((passage) => passage.id === `${roomId}-rear-door`)!
      const interior = fromFor(roomId === sampleRoomIds[0] ? 3.5 : 16.5, 17)
      expect(findMainlinePath(interior, rear.thresholds[0], street, {}, { screenMetrics: sceneDesignReferenceMetrics }), `${roomId} rear-door threshold`).not.toBeNull()

      const rearPartitionCrossing = [fromFor(roomId === sampleRoomIds[0] ? 4 : 17, 22), fromFor(roomId === sampleRoomIds[0] ? 9 : 21, 22)]
      expect(canTravelAlongMainlineSegment(rearPartitionCrossing[0], rearPartitionCrossing[1], street), `${roomId} closed divider blocks the rear zone`).toBe(false)
      const warehouseDoor = street.objects.find((entity) => entity.id === `${roomId === sampleRoomIds[0] ? 'commercial-s5-milk-tea' : 'commercial-s2-fast-food'}-warehouse-door`)!
      const warehouseApproach = fromFor(roomId === sampleRoomIds[0] ? 3.5 : 20.5, 15)
      expect(findMainlinePath(warehouseApproach, warehouseDoor.position, street), `${roomId} marked warehouse doorway remains reachable`).not.toBeNull()
    }
  })

  it('labels the independent kitchen and warehouse areas without changing the shared door label', () => {
    const signs = street.objects.filter((entity) => entity.id.endsWith('-sign'))
    expect(signs.map((entity) => entity.label).sort()).toEqual(['仓库', '厨房'])
    expect(signs.every((entity) => entity.interactive === false && entity.roomId)).toBe(true)
    const internalDoors = street.objects.filter((entity) => entity.id.endsWith('-door')
      && sampleRoomIds.includes(entity.roomId as typeof sampleRoomIds[number]))
    expect(internalDoors).toHaveLength(2)
    expect(internalDoors.every((entity) => entity.label === '门')).toBe(true)
    for (const sign of signs) {
      const overlapsNearbyLabel = street.objects.some((entity) => entity.roomId === sign.roomId && entity.id !== sign.id
        && Math.abs(entity.position.y - sign.position.y) < steps.vertical * .75
        && Math.abs(entity.position.x - sign.position.x) < steps.horizontal * 1.4)
      expect(overlapsNearbyLabel, `${sign.id} has clear text space`).toBe(false)
    }
  })

  it('retains six service identities with milk menu in the wall and order/pickup in the real counter', () => {
    const labels=street.objects.filter(o=>o.id.endsWith('-service-label'))
    expect(labels).toHaveLength(6)
    const milk=labels.filter(o=>o.roomId===sampleRoomIds[0]),fast=labels.filter(o=>o.roomId===sampleRoomIds[1])
    expect(milk.map(o=>o.id).sort()).toEqual(['menu','order','pickup'].map(k=>`commercial-s5-milk-tea-${k}-service-label`).sort())
    expect(fast.map(o=>o.label).sort()).toEqual(['菜单','点单','取餐'].sort())
    expect(milk).toHaveLength(3);expect(fast).toHaveLength(3)
    expect(labels.every(o=>o.visualVisibility==='static')).toBe(true)
    expect(milk.every(o=>o.interactive===true)).toBe(true)
    expect(fast.every(o=>o.interactive===false)).toBe(true)
    for(const label of milk){
      const result=findMainlinePathToEntity(street,label.id,shellInside('commercial-south-slot-5'),{},referenceOptions)
      expect(result.path,label.id).not.toBeNull()
      expect(isWalkableMainlinePoint(result.target,street,{},referenceOptions)).toBe(true)
      const room=street.rooms.find(r=>r.id===sampleRoomIds[0])!
      expect((result.target.x-room.bounds.x)*19.2).toBeLessThan(216)
      expect(street.explorationText?.[label.id]?.[0]).toBeTruthy()
    }
    const menu=milk.find(o=>o.id.includes('-menu-'))!
    expect(menu.surface).toBe('wall')
    for(const label of milk.filter(o=>o!==menu)) {
      expect(['柜','台']).toContain(label.label)
      expect(label.interactionStructureId).toBe('milk-tea-trial-long-counter-body')
      expect(isWalkableMainlinePoint(label.position,street,{},referenceOptions)).toBe(false)
    }
    expect(milk.some(o=>['点单','取餐','取货'].includes(o.label))).toBe(false)
    const order=milk.find(o=>o.id.includes('-order-'))!,pickup=milk.find(o=>o.id.includes('-pickup-'))!
    expect((pickup.position.y-order.position.y)*10.8).toBeCloseTo(208,5)
    for(const label of fast){
      expect(localCell(sampleRoomIds[1],label.position).column).toBeLessThan(14)
      expect(findMainlinePath(shellInside('commercial-south-slot-2'),label.position,street)).not.toBeNull()
      expect(street.objects.some(o=>o.roomId===sampleRoomIds[1]&&o.id!==label.id
        &&Math.abs(o.position.y-label.position.y)<steps.vertical*.75
        &&Math.abs(o.position.x-label.position.x)<steps.horizontal*1.4)).toBe(false)
    }
    expect(Math.abs(localCell(sampleRoomIds[1],fast.find(o=>o.id.includes('-order-'))!.position).row
      -localCell(sampleRoomIds[1],fast.find(o=>o.id.includes('-pickup-'))!.position).row)).toBeGreaterThan(3)
  })

  it('keeps each chair rest, pull, sit and stand-up approach reachable in all three groups', () => {
    const tableEntryByGroup = new Map([
      ['commercial-s5-milk-tea-table-group', 'commercial-south-slot-5'],
      ['commercial-s2-fast-food-table-group-a', 'commercial-south-slot-2'],
      ['commercial-s2-fast-food-table-group-b', 'commercial-south-slot-2'],
    ])
    const seats = street.objects.filter((entity) => entity.kind === 'seat' && entity.seat
      && sampleRoomIds.includes(entity.roomId as typeof sampleRoomIds[number]))
    expect(seats).toHaveLength(4)
    for (const seat of seats) {
      const slotId = tableEntryByGroup.get(seat.groupId!)!
      const slot = street.storefronts.find((candidate) => candidate.id === slotId)!
      const start = shellInside(slot.id)
      const { rest, pulled, sit } = seat.seat!
      const sitPosition = resolveMainlineSeatSitPosition(street, seat.id)!
      const seatApproach = findMainlinePathToEntity(street, seat.id, start)
      expect(seatApproach.path, `${seat.id} chair interaction can be approached`).not.toBeNull()
      expect(rest).toEqual(seat.position)
      expect(seat.approach).toEqual(pulled)
      expect(isWalkableMainlinePoint(seatApproach.target, street), `${seat.id} pull contact`).toBe(true)
      expect(sitPosition).toEqual(seat.position)
      expect(sit).toBeDefined()
      const seatedOptions = { occupiedSeatIds: new Set([seat.id]) }
      expect(findMainlinePath(seatApproach.target, sitPosition, street, {}, seatedOptions), `${seat.id} can sit from its pull contact`).not.toBeNull()
      expect(findMainlinePath(sitPosition, start, street, {}, seatedOptions), `${seat.id} can stand and reach the entry`).not.toBeNull()
    }
  })
})
