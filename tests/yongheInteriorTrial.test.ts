import { describe, it, expect } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineEntityTextFootprint } from '../src/center/runtime/sceneLayout'
import { findMainlinePathToEntity, canActorReachPassageApproach, isWalkableMainlinePoint, canTravelAlongMainlineSegment, findMainlinePath } from '../src/center/runtime/mainlineNavigation'
import { mainlineSceneBlueprints } from '../src/center/runtime/mainlineSceneModel'
import { isMainlineSeatAvailable, mainlineSceneOccupiedSeatIds, nextMainlinePlayerSeatId } from '../src/center/runtime/mainlineSeating'
import { counterOutlineGeometry } from '../src/center/runtime/counterOutlineGeometry'
import { frameShouldCollapse } from '../src/center/runtime/sceneFrameLifecycle'

for (const sceneId of ['yonghe-mining-perimeter', 'yonghe-eatery'] as const) {
  const scene = mainlineScenes[sceneId]
  const room = scene.rooms.find(entry => entry.id === 'mining-shop-2-interior')!
  const frontX = room.bounds.width * 19.2
  const point = (x: number, y: number) => ({ x: room.bounds.x + (frontX - y) / 19.2, y: room.bounds.y + x / 10.8 })
  const options = { screenMetrics: sceneDesignReferenceMetrics }

  describe(sceneId + ' rotated restaurant', () => {
    it('keeps the menu on the right wall and rotates the existing tables and kitchen with the room', () => {
      expect(room.bounds.width * 19.2).toBeCloseTo(308, 3)
      expect(room.bounds.height * 10.8).toBeCloseTo(588, 3)
      const shell = mainlineSceneBlueprints[sceneId].scene.walls.find(wall => wall.id === `${room.id}-shell`)!
      expect(shell.boundaryWorldGrid?.pitchPx).toBe(28)
      expect(Math.round(shell.bounds.height * 10.8 / shell.boundaryWorldGrid!.pitchPx) + 1).toBe(22)
      const menu = scene.objects.find(object => object.id === 'yonghe-menu')!
      const menuLocalX = 406
      expect(menu.position.x).toBeCloseTo(point(menuLocalX, 0).x, 10)
      expect(menu.position.y).toBeCloseTo(point(menuLocalX, 0).y, 10)
      expect(menu.textLayout).toBe('vertical')
      const menuFeature = scene.structures.find(structure => structure.id === `${room.id}-shell`)?.features?.find(feature => feature.id === 'yonghe-menu-wall')!
      expect(menuFeature.start).toBeGreaterThanOrEqual(room.bounds.y - 0.001)
      expect(menuFeature.end).toBeLessThanOrEqual(room.bounds.y + room.bounds.height + 0.001)
      expect(menuFeature.end).toBeLessThan(room.bounds.y + room.bounds.height + 0.001)
      expect(scene.objects.filter(object => object.roomId === room.id && object.kind === 'table')).toHaveLength(4)
      expect(scene.objects.filter(object => object.roomId === room.id && object.seat)).toHaveLength(8)
      const withinRoom = (box: { x:number;y:number;width:number;height:number }) => {
        expect((box.x-room.bounds.x)*19.2).toBeGreaterThanOrEqual(-0.01)
        expect((room.bounds.x+room.bounds.width-box.x-box.width)*19.2).toBeGreaterThanOrEqual(-0.01)
        expect((box.y-room.bounds.y)*10.8).toBeGreaterThanOrEqual(-0.01)
        expect((room.bounds.y+room.bounds.height-box.y-box.height)*10.8).toBeGreaterThanOrEqual(-0.01)
      }
      for (const table of scene.objects.filter(object => object.roomId === room.id && object.kind === 'table')) {
        const expectedDepth = table.id === 'yonghe-upper-left-group-table' || table.id === 'yonghe-lower-left-group-table' ? 420 : 532
        expect((table.position.y-room.bounds.y)*10.8).toBeCloseTo(expectedDepth, 3)
        const tableBox = mainlineEntityTextFootprint(table, table.position, sceneDesignReferenceMetrics)
        withinRoom(tableBox)
        if (table.shape) withinRoom(table.shape)
        if (table.collision) withinRoom(table.collision)
        const seats = scene.objects.filter(object => object.seat?.tableId === table.id)
        expect(seats).toHaveLength(2)
        for (const seat of seats) {
          expect(seat.textLayout).toBeUndefined()
          expect(seat.position.x).toBeCloseTo(table.position.x, 8)
          expect(Math.abs((seat.position.y - table.position.y) * 10.8)).toBeCloseTo(30, 3)
          const seatBox = mainlineEntityTextFootprint(seat, seat.position, sceneDesignReferenceMetrics)
          withinRoom(seatBox)
          if (seat.shape) withinRoom(seat.shape)
          if (seat.collision) withinRoom(seat.collision)
          const gapPx = seat.position.y < table.position.y
            ? (tableBox.y - seatBox.y - seatBox.height) * 10.8
            : (seatBox.y - tableBox.y - tableBox.height) * 10.8
          expect(gapPx).toBeCloseTo(14, 2)
        }
      }
      const stove = scene.objects.find(object => object.id === 'yonghe-stove')!
      expect(stove.position.x).toBeCloseTo(point(84, 8).x, 10)
      expect(stove.position.y).toBeCloseTo(point(84, 8).y, 10)
      expect(scene.passages.find(passage => passage.id === 'yonghe-back-door')?.access).toBe('locked')
      const rear = scene.objects.find(object => object.id === 'yonghe-back-door')!
      expect(rear.position.x).toBeCloseTo(point(0, 252).x, 10)
      expect(rear.position.y).toBeCloseTo(point(0, 252).y, 10)
      const old = point(0, 168)
      const atOld = scene.geometry.filter(unit => unit.x <= old.x && unit.x + unit.width >= old.x && unit.y <= old.y && unit.y + unit.height >= old.y)
      expect(atOld.some(unit => unit.navigation.passageId === 'yonghe-back-door')).toBe(false)
      expect(atOld.some(unit => unit.navigation.blocked)).toBe(true)
      expect(isWalkableMainlinePoint(old, scene, {}, options)).toBe(false)
    })

    it('does not expose the removed central-lane survey placeholder or its test description', () => {
      expect(scene.objects.some(object => object.id === 'yonghe-survey-central-lane')).toBe(false)
      expect(scene.explorationText?.['yonghe-survey-central-lane']).toBeUndefined()
    })

    it('reaches each seat and menu from the customer aisle while chair-table gaps stay blocked', () => {
      const from = point(364, 154)
      const streetEntry = scene.passages.find(passage => passage.id === 'yonghe-street-entry')!
      const roomSideOfEntry = streetEntry.crossingTargets[0]
      for (const entity of scene.objects.filter(object => object.seat && object.roomId === room.id && object.id.startsWith('yonghe-'))) {
        expect(findMainlinePathToEntity(scene, entity.id, from, {}, options).path, entity.id).not.toBeNull()
        if (entity.seat && (entity.seat.tableId === 'yonghe-upper-right-group-table' || entity.seat.tableId === 'yonghe-lower-right-group-table')) {
          expect(findMainlinePathToEntity(scene, entity.id, roomSideOfEntry, {}, options).path, `${entity.id} from doorway`).not.toBeNull()
        }
        expect(isMainlineSeatAvailable(scene, entity.id)).toBe(true)
        expect(nextMainlinePlayerSeatId(scene, null, entity.id)).toBe(entity.id)
        expect(mainlineSceneOccupiedSeatIds(scene, entity.id).has(entity.id)).toBe(true)
        const table = scene.objects.find(object => object.id === entity.seat!.tableId)!
        const middle = { x: (entity.position.x + table.position.x) / 2, y: entity.position.y }
        expect(Math.abs(entity.position.y - table.position.y) * 10.8).toBeCloseTo(30, 3)
        for (const width of [11, 16]) {
          expect(canTravelAlongMainlineSegment(
            { x: middle.x, y: middle.y - 2 / 10.8 },
            { x: middle.x, y: middle.y + 2 / 10.8 },
            scene, {}, { ...options, actorFootprint: { width: width / 19.2, height: width / 10.8 } },
          )).toBe(false)
        }
      }
      expect(findMainlinePathToEntity(scene, 'yonghe-menu', from, {}, options).path).not.toBeNull()
      expect(canActorReachPassageApproach(scene, scene.passages.find(passage => passage.id === 'yonghe-street-entry')!, from, {}, options)?.path).not.toBeNull()
    })

    it('keeps both outdoor table groups in the street and clears the front-door approach', () => {
      const lane = scene.rooms.find(entry => entry.id === 'mining-street-public-lane')!
      for (const group of scene.furnitureGroups.filter(entry => entry.id.startsWith('yonghe-outdoor-'))) {
        for (const id of group.entityIds) {
          const object = scene.objects.find(entry => entry.id === id)!
          expect(object.position.y - 8 / 10.8).toBeGreaterThan(room.bounds.y + room.bounds.height)
          expect(object.position.y + 8 / 10.8).toBeLessThan(lane.bounds.y + lane.bounds.height)
          expect(object.position.x).toBeGreaterThan(room.bounds.x)
          expect(object.position.x).toBeLessThanOrEqual(room.bounds.x + room.bounds.width)
        }
      }
      const entrance = scene.passages.find(passage => passage.id === 'yonghe-street-entry')!
      expect(isWalkableMainlinePoint(entrance.thresholds[0], scene, {}, options)).toBe(true)
      const ownedYongheWallCells = [...new Set(scene.geometry.flatMap(unit => unit.storefrontId === 'yonghe-slot-2' && unit.variant === 'baseline'
        ? unit.visual.cells.filter(cell => cell.storefrontRole === 'wall').map(cell => Math.round(frontX - (cell.x-room.bounds.x)*19.2))
        : []))].sort((a,b)=>a-b)
      expect(ownedYongheWallCells).toEqual([28,56,84,224,252,280])
      expect(ownedYongheWallCells).not.toContain(0)
      for (const [groupIndex, centers] of [[1, [84, 56, 28]], [2, [280, 252, 224]]] as const) {
        const group = scene.furnitureGroups.find(entry => entry.id === `yonghe-outdoor-group-${groupIndex}`)!
        const objects = group.entityIds.map(id => scene.objects.find(entry => entry.id === id)!).sort((a, b) => a.position.x - b.position.x)
        expect(objects.map(object => object.label)).toEqual(['椅', '桌', '椅'])
        expect(objects.map(object => object.textLayout)).toEqual(['vertical', 'vertical', 'vertical'])
        const localAcross = objects.map(object => Math.round(frontX - (object.position.x - room.bounds.x) * 19.2))
        expect(localAcross).toEqual(centers)
        expect(localAcross.every(center => ownedYongheWallCells.includes(center))).toBe(true)
        const table = objects.find(object => object.kind === 'table')!
        expect(table.focusFrame).toBe('interactive')
        expect(table.roomId).toBeUndefined()
        expect(table.visible).not.toBe(false)
        expect(frameShouldCollapse({
          group: `interactive:${table.id}`, policy: 'interactive', phase: 'closed', gateTriggered: false,
          interactionBusy: false, interactionActive: false, retractRequested: false, suppressed: false,
        }, {
          corner: 'top-left', phase: 'hidden', fullyCollapsed: true, preserveCornerOnResume: false, resumeCorner: null,
          transitionDirection: null, transitionStartedAt: 0, initialized: false, hovered: false, locked: false,
        })).toBe(false)
      }
      expect(scene.continuousStructures.some(body => body.counterSurface?.groupId.startsWith('yonghe-outdoor-table-'))).toBe(false)
    })

    it('keeps the work zone staff-only, counter continuous, and rear door unreachable through the wall', () => {
      const staff = { ...options, actorId: 'yonghe-trial-worker', actorFootprint: { width: 16 / 19.2, height: 16 / 10.8 } }
      const workerStart = point(168, 154)
      expect(isWalkableMainlinePoint(workerStart, scene, {}, options)).toBe(false)
      expect(isWalkableMainlinePoint(workerStart, scene, {}, staff)).toBe(true)
      expect(findMainlinePath(workerStart, point(280, 154), scene, {}, staff)).not.toBeNull()
      const rear = scene.passages.find(passage => passage.id === 'yonghe-back-door')!
      expect(findMainlinePath(point(560, 282), rear.thresholds[0], scene, {}, staff)).not.toBeNull()
      expect(findMainlinePath(workerStart, rear.thresholds[0], scene, {}, staff)).not.toBeNull()
      expect(findMainlinePath(rear.thresholds[0], rear.crossingTargets[0]!, scene, {}, staff)).toBeNull()
      for (const width of [11, 16]) {
        expect(canTravelAlongMainlineSegment(point(196, 14), point(252, 14), scene, {}, {
          ...staff, actorFootprint: { width: width / 19.2, height: width / 10.8 },
        })).toBe(false)
      }
      const counter = scene.continuousStructures.find(body => body.id === 'yonghe-trial-counter-body')!
      const counterCells = scene.objects.filter(object => object.id === 'yonghe-counter' || object.id.startsWith('yonghe-trial-counter-'))
      expect(counterCells).toHaveLength(16)
      expect(counterCells.every(cell => cell.counterSurfaceId === counter.id && cell.interactionStructureId === counter.id)).toBe(true)
      expect(counter.counterSurface?.hideLabel).toBe(true)
      expect(counter.counterSurface?.interactionEntityId).toBe('yonghe-counter')
      expect(counterCells.filter(cell => cell.interactive).map(cell => cell.id)).toEqual(['yonghe-counter'])
      expect(counter.width * 19.2).toBeCloseTo(256, 3)
      expect(counter.height * 10.8).toBeCloseTo(16, 3)
      expect(counter.x + counter.width).toBeCloseTo(room.bounds.x + room.bounds.width, 8)
      expect(308 - 256).toBe(52)
      expect(308 - 256 - 11).toBe(41)
      const worktop = scene.continuousStructures.filter(body => body.counterSurface?.groupId === 'yonghe-trial-worktop-L')
      expect(worktop).toHaveLength(2)
      expect(counterOutlineGeometry(worktop.map(body => ({ x:body.x*19.2,y:body.y*10.8,width:body.width*19.2,height:body.height*10.8 }))).loops).toHaveLength(1)
    })
  })
}
