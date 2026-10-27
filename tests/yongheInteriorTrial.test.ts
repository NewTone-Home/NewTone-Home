import { describe, it, expect } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineEntityTextFootprint } from '../src/center/runtime/sceneLayout'
import { findMainlinePathToEntity, canActorReachPassageApproach, isWalkableMainlinePoint, canTravelAlongMainlineSegment, findMainlinePath, resolveMainlineEntityInteraction } from '../src/center/runtime/mainlineNavigation'
import { mainlineActiveSpatialSpaceId, mainlineEntityBelongsToActiveSpace, mainlineEntityMatchesCurrentPresentation, mainlineSceneBlueprints } from '../src/center/runtime/mainlineSceneModel'
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
      expect(stove.position.x).toBeCloseTo(point(102, 22).x, 10)
      expect(stove.position.y).toBeCloseTo(point(102, 22).y, 10)
      expect(stove.textLayout).toBe('vertical')
      const board = scene.objects.find(object => object.id === 'yonghe-trial-board')!
      expect(board.position.x).toBeCloseTo(point(22, 100).x, 10)
      expect(board.position.y).toBeCloseTo(point(22, 100).y, 10)
      expect(scene.passages.find(passage => passage.id === 'yonghe-back-door')?.access).toBe('open')
      const rear = scene.objects.find(object => object.id === 'yonghe-back-door')!
      expect(rear.position.x).toBeCloseTo(point(0, 280).x, 10)
      expect(rear.position.y).toBeCloseTo(point(0, 280).y, 10)
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

    it('places a locked warehouse door to the right of the Yonghe back door without a destination', () => {
      const rear = scene.objects.find(object => object.id === 'yonghe-back-door')!
      const warehouse = scene.objects.find(object => object.id === 'yonghe-warehouse-door')!
      const passage = scene.passages.find(candidate => candidate.id === 'yonghe-warehouse-door')!
      expect(warehouse.position.x).toBeGreaterThan(rear.position.x)
      expect(passage.access).toBe('locked')
      expect(passage.routeThrough).not.toBe(true)
      expect(passage.targetSceneId).toBeUndefined()
      expect(passage.toRoomId).toBeUndefined()
      expect(passage.lockedText).toBe('\u95e8\u9501\u7740\uff0c\u6253\u4e0d\u5f00\u3002')
      expect(warehouse.interactionBehavior).toBe('yonghe-warehouse')
    })

    it('frames the four indoor tables on entry and re-entry, and hides them outside the room', () => {
      const indoorTables = scene.objects.filter(object => object.roomId === room.id && object.kind === 'table')
      expect(indoorTables.map(table => table.id)).toEqual([
        'yonghe-upper-left-group-table',
        'yonghe-upper-right-group-table',
        'yonghe-lower-left-group-table',
        'yonghe-lower-right-group-table',
      ])

      const activeRooms = new Set([room.id])
      const outsideRooms = new Set<string>()
      const cafeTables = mainlineScenes['commercial-street'].objects.filter(object => object.id.startsWith('cafe-trial-table-group-') && object.kind === 'table')
      expect(cafeTables.length).toBeGreaterThan(0)

      for (const table of indoorTables) {
        expect(table.focusFrame).toBe('interactive')
        expect(table.label).toBe('桌子')
        expect(table.shape?.width).toBeCloseTo(16 / 1920 * 100, 8)
        expect(table.shape?.height).toBeCloseTo(32 / 1080 * 100, 8)
        expect(mainlineEntityMatchesCurrentPresentation(table, activeRooms)).toBe(true)
        expect(mainlineEntityMatchesCurrentPresentation(table, outsideRooms)).toBe(false)
        // The same target is eligible again after leaving and re-entering.
        expect(mainlineEntityMatchesCurrentPresentation(table, activeRooms)).toBe(true)
        expect(frameShouldCollapse({
          group: `interactive:${table.id}`, policy: 'interactive', phase: 'closed', gateTriggered: false,
          interactionBusy: false, interactionActive: false, retractRequested: false, suppressed: false,
        }, {
          corner: 'top-left', phase: 'hidden', fullyCollapsed: true, preserveCornerOnResume: false, resumeCorner: null,
          transitionDirection: null, transitionStartedAt: 0, initialized: false, hovered: false, locked: false,
        })).toBe(false)
      }
      expect(indoorTables.every(table => cafeTables.some(cafeTable => cafeTable.focusFrame === table.focusFrame))).toBe(true)
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

    it('shows and permits outdoor tables only while the actor belongs to the public lane', () => {
      const lane = scene.rooms.find(entry => entry.id === 'mining-street-public-lane')!
      const lanePoint = { x: lane.bounds.x + lane.bounds.width / 2, y: lane.bounds.y + lane.bounds.height / 2 }
      const yongheInterior = scene.rooms.find(entry => entry.id === 'mining-shop-2-interior')!
      const interiorPoint = { x: yongheInterior.bounds.x + yongheInterior.bounds.width / 2, y: yongheInterior.bounds.y + yongheInterior.bounds.height / 2 }
      const otherShop = scene.rooms.find(entry => entry.id === 'mining-shop-1-interior')!
      const otherShopPoint = { x: otherShop.bounds.x + otherShop.bounds.width / 2, y: otherShop.bounds.y + otherShop.bounds.height / 2 }
      const renderedRooms = new Set<string>()
      const outdoorIds = scene.furnitureGroups.filter(group => group.id.startsWith('yonghe-outdoor-')).flatMap(group => group.entityIds)
      const outdoorEntities = outdoorIds.map(id => scene.objects.find(entity => entity.id === id)!)

      expect(outdoorEntities).toHaveLength(6)
      expect(outdoorEntities.every(entity => entity.spaceId === lane.id && entity.roomId === undefined)).toBe(true)
      expect(mainlineActiveSpatialSpaceId(scene, lanePoint)).toBe(lane.id)
      expect(mainlineActiveSpatialSpaceId(scene, interiorPoint)).toBe(yongheInterior.id)
      expect(mainlineActiveSpatialSpaceId(scene, otherShopPoint)).toBe(otherShop.id)
      for (const entity of outdoorEntities) {
        expect(mainlineEntityBelongsToActiveSpace(entity, lane.id)).toBe(true)
        expect(mainlineEntityBelongsToActiveSpace(entity, yongheInterior.id)).toBe(false)
        expect(mainlineEntityBelongsToActiveSpace(entity, otherShop.id)).toBe(false)
        expect(mainlineEntityMatchesCurrentPresentation(entity, renderedRooms, lane.id)).toBe(true)
        expect(mainlineEntityMatchesCurrentPresentation(entity, renderedRooms, yongheInterior.id)).toBe(false)
        expect(mainlineEntityMatchesCurrentPresentation(entity, renderedRooms, otherShop.id)).toBe(false)
      }

      const table = outdoorEntities.find(entity => entity.kind === 'table')!
      expect(resolveMainlineEntityInteraction(scene, table.id, lanePoint, {}, options).path).not.toBeNull()
      for (const indoorPoint of [interiorPoint, otherShopPoint]) {
        const blocked = resolveMainlineEntityInteraction(scene, table.id, indoorPoint, {}, options)
        expect(blocked.path).toBeNull()
        expect(blocked.inRange).toBe(false)
      }

      const streetDoor = scene.objects.find(entity => entity.id === 'yonghe-street-entry')!
      expect(streetDoor.spaceId).toBeUndefined()
      expect(scene.passages.find(passage => passage.id === 'yonghe-street-entry')?.access).toBe('open')
      expect(scene.passages.find(passage => passage.id === 'yonghe-back-door')?.access).toBe('open')
    })

  it('keeps the work zone staff-only, counter continuous, and rear door connected to the alley', () => {
      const stove = scene.objects.find(object => object.id === 'yonghe-stove')!
      const board = scene.objects.find(object => object.id === 'yonghe-trial-board')!
      const staff = { ...options, actorId: 'yonghe-trial-worker', actorFootprint: { width: 16 / 19.2, height: 16 / 10.8 } }
      const workerStart = point(168, 154)
      // The reduced staff-only rectangle is exactly the authored work zone;
      // the customer aisle and the rear-door approach remain outside it.
      const stovePoint = point(102, 22)
      const worktopPoint = point(22, 100)
      const legalRearAislePoint = point(280, 280)
      expect(isWalkableMainlinePoint(workerStart, scene, {}, options)).toBe(false)
      expect(isWalkableMainlinePoint(stovePoint, scene, {}, options)).toBe(false)
      expect(isWalkableMainlinePoint(worktopPoint, scene, {}, options)).toBe(false)
      expect(isWalkableMainlinePoint(legalRearAislePoint, scene, {}, options)).toBe(true)
      const rearDoorPassage = scene.passages.find(passage => passage.id === 'yonghe-back-door')!
      const rearDoorOpen = { ...options, openPassageIds: new Set([rearDoorPassage.id]) }
      expect(findMainlinePath(legalRearAislePoint, rearDoorPassage.thresholds[1], scene, {}, rearDoorOpen)).not.toBeNull()
      expect(isWalkableMainlinePoint(workerStart, scene, {}, staff)).toBe(true)
      expect(findMainlinePath(workerStart, point(280, 154), scene, {}, staff)).not.toBeNull()
      const workZone = scene.accessRegions.find(region => region.id === 'yonghe-trial-kitchen')!
      expect(workZone.width * 19.2).toBeCloseTo(216, 2)
      expect(workZone.height * 10.8).toBeCloseTo(224, 2)
      const rear = scene.passages.find(passage => passage.id === 'yonghe-back-door')!
      const rearOpen = { ...staff, openPassageIds: new Set([rear.id]) }
      expect(findMainlinePath(point(560, 282), rear.thresholds[1], scene, {}, rearOpen)).not.toBeNull()
      expect(findMainlinePath(workerStart, rear.thresholds[1], scene, {}, rearOpen)).not.toBeNull()
      expect(findMainlinePath(rear.thresholds[1], rear.thresholds[0], scene, {}, rearOpen)).not.toBeNull()
      for (const width of [11, 16]) {
        expect(canTravelAlongMainlineSegment(point(196, 14), point(252, 14), scene, {}, {
          ...staff, actorFootprint: { width: width / 19.2, height: width / 10.8 },
        })).toBe(false)
      }
      const counter = scene.continuousStructures.find(body => body.id === 'yonghe-trial-counter-body')!
      const counterCells = scene.objects.filter(object => object.id === 'yonghe-counter' || object.id.startsWith('yonghe-trial-counter-'))
      expect(counterCells).toHaveLength(16)
      expect(counterCells.every(cell => cell.counterSurfaceId === counter.id && cell.interactionStructureId === counter.id)).toBe(true)
      expect(counter.counterSurface?.hideLabel).toBe(false)
      expect(counter.counterSurface?.label).toBeUndefined() // the surface's existing default renders one centered 柜台 label
      expect(counter.counterSurface?.interactionEntityId).toBe('yonghe-counter')
      expect(counterCells.filter(cell => cell.interactive).map(cell => cell.id)).toEqual(['yonghe-counter'])
      expect(counter.width * 19.2).toBeCloseTo(256, 3)
      expect(counter.height * 10.8).toBeCloseTo(16, 3)
      expect(counter.x + counter.width).toBeCloseTo(room.bounds.x + room.bounds.width, 8)
      const counterOutline = counter.counterSurface!.outlineBounds!
      const outlineLocal = {
        x: (counterOutline.y - room.bounds.y) * 10.8,
        y: frontX - (counterOutline.x + counterOutline.width - room.bounds.x) * 19.2,
        width: counterOutline.height * 10.8,
        height: counterOutline.width * 19.2,
      }
      expect(outlineLocal.x).toBeCloseTo(212, 2)
      expect(outlineLocal.y).toBeCloseTo(-14, 2)
      expect(outlineLocal.width).toBeCloseTo(24, 2)
      expect(outlineLocal.height).toBeCloseTo(274, 2)
      expect(counter.width * 19.2).toBeCloseTo(256, 3) // visual outline expands independently of the clickable surface
      expect(308 - 256).toBe(52)
      expect(308 - 256 - 11).toBe(41)
      const worktop = scene.continuousStructures.filter(body => body.counterSurface?.groupId === 'yonghe-trial-worktop-L')
      expect(worktop).toHaveLength(2)
      expect(counterOutlineGeometry(worktop.map(body => ({ x:body.x*19.2,y:body.y*10.8,width:body.width*19.2,height:body.height*10.8 }))).loops).toHaveLength(1)
      const topLeg = worktop.find(body => body.id.endsWith('back-body'))!
      const rightLeg = worktop.find(body => body.id.endsWith('right-body'))!
      expect(topLeg.width * 19.2).toBeCloseTo(180, 3)
      expect(topLeg.height * 10.8).toBeCloseTo(24, 3)
      expect(rightLeg.width * 19.2).toBeCloseTo(24, 3)
      expect(rightLeg.height * 10.8).toBeCloseTo(180, 3)
      const localBox = (body: typeof topLeg) => ({
        x: (body.y - room.bounds.y) * 10.8,
        y: frontX - (body.x + body.width - room.bounds.x) * 19.2,
        width: body.height * 10.8,
        height: body.width * 19.2,
      })
      const top = localBox(topLeg), right = localBox(rightLeg)
      expect(top.x).toBeCloseTo(10, 2)
      expect(top.x + top.width).toBeCloseTo(34, 2)
      expect(right.y).toBeCloseTo(10, 2)
      expect(right.y + right.height).toBeCloseTo(34, 2)
      // Wall glyphs are 16px wide around the boundary anchors; the outline's 1px stroke leaves 1px clear.
      expect(top.x - 1 - 8).toBeCloseTo(1, 2)
      expect(right.y - 1 - 8).toBeCloseTo(1, 2)
      const stoveBox = mainlineEntityTextFootprint(stove, stove.position, sceneDesignReferenceMetrics)
      const stoveLocalX = (stoveBox.y - room.bounds.y) * 10.8
      const stoveLocalY = frontX - (stoveBox.x + stoveBox.width - room.bounds.x) * 19.2
      expect(stoveLocalX).toBeGreaterThanOrEqual(right.x)
      expect(stoveLocalX + stoveBox.height * 10.8).toBeLessThanOrEqual(right.x + right.width)
      expect(stoveLocalY).toBeGreaterThanOrEqual(right.y)
      expect(stoveLocalY + stoveBox.width * 19.2).toBeLessThanOrEqual(right.y + right.height)
      const boardBox = mainlineEntityTextFootprint(board, board.position, sceneDesignReferenceMetrics)
      const boardLocalX = (boardBox.y - room.bounds.y) * 10.8
      const boardLocalY = frontX - (boardBox.x + boardBox.width - room.bounds.x) * 19.2
      expect(boardLocalX).toBeGreaterThanOrEqual(top.x)
      expect(boardLocalX + boardBox.height * 10.8).toBeLessThanOrEqual(top.x + top.width)
      expect(boardLocalY).toBeGreaterThanOrEqual(top.y)
      expect(boardLocalY + boardBox.width * 19.2).toBeLessThanOrEqual(top.y + top.height)
    })
  })
}
