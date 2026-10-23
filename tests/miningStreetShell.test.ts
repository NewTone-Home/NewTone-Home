import { canTravelAlongMainlineSegment, isWalkableMainlinePoint, resolveMainlineWorldNavigation } from '../src/center/runtime/mainlineNavigation'
import { describe, expect, it } from 'vitest'
import { createMiningStreetShellBlueprint, miningGrid, miningShopShells } from '../src/center/runtime/miningStreetShell'
import { mainlineCanonicalSceneGeometryUnits, mainlineSceneGeometryUnits, mainlineScenes, validateMainlineSceneGeometry } from '../src/center/runtime/mainlineScenes'
import { activeStorefrontInteriorOwner, activeStorefrontPresentationOwner, storefrontCharacterCells } from '../src/center/runtime/storefrontPresentation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const scene = mainlineScenes['yonghe-mining-perimeter']
const lane = scene.rooms.find(room => room.id === 'mining-street-public-lane')!
describe('mining clockwise continuous street shell', () => {
  it('keeps all eight storefronts on one map and opens only Yonghe', () => {
    expect(scene.rooms).toHaveLength(9)
    expect(scene.storefronts).toHaveLength(8)
    const dining = scene.objects.filter(object => object.kind === 'table' || object.kind === 'seat')
    expect(dining).toHaveLength(18)
    expect(dining.every(object => object.id.startsWith('yonghe-'))).toBe(true)
    expect(dining.filter(object => object.roomId === 'mining-shop-2-interior' && object.kind === 'seat')).toHaveLength(8)
    for (const shop of miningShopShells) {
      const passage = scene.passages.find(entry => entry.portalId === shop.portalId)!
      expect(passage).toMatchObject({
        routeThrough: true,
        fromRoomId: 'mining-street-public-lane',
        toRoomId: shop.roomId,
        access: shop.portalId === 'yonghe-street-entry' ? 'open' : 'locked',
      })
      expect(passage.targetSceneId).toBeUndefined()
      if (shop.portalId !== 'yonghe-street-entry') expect(passage.lockedText).toBe('没有权限进去。')
    }
    for (const room of scene.rooms.filter(entry => entry.id !== 'mining-shop-2-interior' && entry.id !== 'mining-street-public-lane')) {
      expect(scene.objects.filter(object => object.roomId === room.id && (object.kind === 'seat' || object.kind === 'table'))).toHaveLength(0)
    }
    expect(validateMainlineSceneGeometry(scene)).toEqual([])
  })

  it('puts the shop row above a horizontal street and the industrial edge below it', () => {
    const industrial = scene.structures.find(structure => structure.id === 'mining-industrial-edge')!
    expect(scene.storefronts.every(slot => slot.edge === 'bottom')).toBe(true)
    for (const shop of miningShopShells) {
      const room = scene.rooms.find(entry => entry.id === shop.roomId)!
      expect(room.bounds.y + room.bounds.height).toBeCloseTo(lane.bounds.y, 7)
      expect(room.bounds.x).toBeLessThan(lane.bounds.x + lane.bounds.width)
      expect(room.bounds.y).toBeLessThan(lane.bounds.y)
    }
    expect(industrial.bounds!.y).toBeCloseTo(lane.bounds.y + lane.bounds.height, 3)
    expect(industrial.features?.some(feature => feature.edge === 'top')).toBe(true)
    expect(scene.externalExits[0]!.axis).toBe('x')
    expect(scene.externalExits[0]!.direction).toBe(-1)
  })

  it('preserves the seven other shop depths and sizes Yonghe as 20 rows plus two end anchors', () => {
    for (const shop of miningShopShells) {
      const room = scene.rooms.find(entry => entry.id === shop.roomId)!
      const ownSlots = shop.letters + 6
      expect(shop.netFrontageSlots).toBe(ownSlots)
      expect(shop.widthCells).toBe(ownSlots + 1) // the extra interval is the shared divider
      expect(shop.depthCoordinateCount).toBe(shop.depthCells + 1)
      expect(room.bounds.width / (28 / 1920 * 100)).toBeCloseTo(shop.widthCells, 7)
      expect(room.bounds.height / (28 / 1080 * 100)).toBeCloseTo(shop.depthCells, 7)
      if (shop.label === '永和小馆') {
        const shell = createMiningStreetShellBlueprint().scene.walls.find(entry => entry.id === shop.roomId + '-shell')!
        expect(shop.netFrontageSlots).toBe(10)
        expect(shop.depthCoordinateCount).toBe(22)
        expect(shop.depthCoordinateCount - 2).toBe(20) // 20 internal rows plus two end-wall anchors
        expect(shop.depthCells).toBe(21) // 21 intervals between the 22 anchors
        expect(shell.boundaryCoordinateCount?.vertical).toBe(22)
      } else {
        expect(shop.depthCoordinateCount).toBe(ownSlots * 2 + 3)
        expect(shop.depthCells).toBe(ownSlots * 2 + 2)
      }
    }
    expect(new Set(miningShopShells.map(shop => shop.depthCells)).size).toBeGreaterThan(1)
  })

  it('fills each deeper shared divider exactly once at the reference wall pitch', () => {
    const units = mainlineCanonicalSceneGeometryUnits(scene, sceneDesignReferenceMetrics)
    const boundaryCells = units
      .filter(unit => unit.geometryKind === 'boundary' && unit.variant !== 'near')
      .flatMap(unit => unit.visual.cells)
      .filter(cell => cell.kind === 'wall' && cell.glyph)
    const ordered = [...miningShopShells].sort((a, b) => a.left - b.left)

    for (let index = 0; index < ordered.length - 1; index++) {
      const leftShop = ordered[index]!
      const rightShop = ordered[index + 1]!
      expect(leftShop.right).toBeCloseTo(rightShop.left, 8)
      const rear = Math.min(leftShop.back, rightShop.back)
      const front = Math.max(leftShop.back, rightShop.back)
      if (front - rear < .001) continue

      const xPx = leftShop.right * 19.2
      const expectedYPx = Array.from(
        { length: Math.round((front - rear) * 10.8 / 28) + 1 },
        (_, cellIndex) => rear * 10.8 + cellIndex * 28,
      )
      for (const yPx of expectedYPx) {
        const matches = boundaryCells.filter(cell => Math.abs(cell.x * 19.2 - xPx) < .05 && Math.abs(cell.y * 10.8 - yPx) < .01)
        expect(matches, `shared divider x=${xPx}, y=${yPx}`).toHaveLength(1)
      }
    }
  })

  it('retains three owned wall slots on both sides and one shared separator between signboards', () => {
    const units = mainlineSceneGeometryUnits(scene, scene.initialPlayerPosition, sceneDesignReferenceMetrics, new Map(scene.storefronts.map(slot => [slot.id, 'baseline'])))
    const cells = units.filter(unit => unit.sourceWallId === 'mining-street-facade').flatMap(unit => unit.visual.cells)
    const ordered = [...miningShopShells].sort((a, b) => a.left - b.left)
    for (let index = 0; index < ordered.length - 1; index++) {
      const a = ordered[index]!, b = ordered[index + 1]!
      expect(a.storefront.composition?.baseline?.slice(0, 3)).toEqual(['wall', 'wall', 'wall'])
      expect(a.storefront.composition?.baseline?.slice(-3)).toEqual(['wall', 'wall', 'wall'])
      const aLastSign = a.firstCenter + (a.letters + 2) * miningGrid.horizontal
      const bFirstSign = b.firstCenter + 3 * miningGrid.horizontal
      const between = cells.filter(cell => cell.x > aLastSign + .01 && cell.x < bFirstSign - .01)
      const wallCenters = new Set(between.filter(cell => cell.kind === 'wall' || cell.storefrontRole === 'wall').map(cell => cell.x.toFixed(2)))
      expect([...wallCenters], a.label + ' / ' + b.label).toHaveLength(7)
    }
  })

  it('keeps character order readable and makes each door reveal at its actual approach', () => {
    for (const slot of scene.storefronts) {
      const units = mainlineCanonicalSceneGeometryUnits(scene, sceneDesignReferenceMetrics)
      const cells = storefrontCharacterCells(scene, slot, units)
      expect(cells.map(cell => cell.baselineGlyph).join('')).toBe(slot.label)
      expect(cells).toHaveLength(slot.label.length)
      const door = cells.find(cell => cell.role === 'door')!
      const doorCells = cells.filter(cell => cell.role === 'door')
      const passage = scene.passages.find(entry => entry.portalId === slot.portalId)!
      expect(door.entityId).toBe(passage.entityId)
      const renderedDoorCenterX = doorCells.reduce((sum, cell) => sum + cell.x / doorCells.length, 0)
      expect(slot.portalId === 'yonghe-street-entry' ? renderedDoorCenterX : door.x)
        .toBeCloseTo(passage.doorway.x + passage.doorway.width / 2, 2)
      expect(door.y).toBeCloseTo(passage.doorway.y + passage.doorway.height / 2, 2)
      if (slot.portalId === 'yonghe-street-entry') {
        expect(doorCells).toHaveLength(2)
        expect(slot.approach!.x).toBeCloseTo(renderedDoorCenterX, 10)
        expect(slot.approach!.y).toBeCloseTo(passage.thresholds[0]!.y, 10)
      } else {
        expect(slot.approach!.x).toBeCloseTo(passage.thresholds[0]!.x, 10)
        expect(slot.approach!.y).toBeCloseTo(passage.thresholds[0]!.y, 10)
      }
      expect(activeStorefrontPresentationOwner(scene, slot.approach!)).toBe(slot.id)
      if (slot.portalId === 'yonghe-street-entry') {
        expect(cells.map(cell => cell.role).join(',')).toBe('wall,door,door,wall')
        expect(cells.map(cell => cell.glyph).join('')).toBe('墙门门墙')
        expect(new Set(cells.map(cell => cell.id)).size).toBe(4)
        expect(doorCells.every(cell => cell.entityId === passage.entityId)).toBe(true)
        expect(doorCells).toHaveLength(2)
        expect(passage.doorway.width * 19.2).toBeCloseTo(56, 1)
        expect(slot.approach!.x).toBeCloseTo(renderedDoorCenterX, 4)
      } else {
        expect(cells.filter(cell => cell.role === 'door')).toHaveLength(1)
      }
    }
  })

  it('allows street walking and permits only Yonghe passage crossing', () => {
    for (const shop of miningShopShells) {
      const passage = scene.passages.find(entry => entry.portalId === shop.portalId)!
      const doorCenterX = shop.storefront.approach!.x
      const outside = { x: doorCenterX, y: shop.doorY + 2 * miningGrid.vertical }
      const inside = { x: doorCenterX, y: shop.doorY - 2 * miningGrid.vertical }
      const closed = { screenMetrics: sceneDesignReferenceMetrics, openPassageIds: new Set<string>() }
      const open = { ...closed, openPassageIds: new Set([passage.id]) }
      expect(resolveMainlineWorldNavigation(scene, scene.initialPlayerPosition, outside, {}, closed)?.reachedRequestedTarget, shop.label).toBe(true)
      expect(canTravelAlongMainlineSegment(outside, inside, scene, {}, closed), shop.label).toBe(false)
      if (shop.portalId === 'yonghe-street-entry') {
        expect(canTravelAlongMainlineSegment(outside, inside, scene, {}, open)).toBe(true)
        expect(canTravelAlongMainlineSegment(inside, outside, scene, {}, open)).toBe(true)
        expect(isWalkableMainlinePoint(inside, scene, {}, closed)).toBe(true)
      } else {
        expect(canTravelAlongMainlineSegment(outside, inside, scene, {}, open)).toBe(false)
        expect(isWalkableMainlinePoint(inside, scene, {}, closed)).toBe(false)
      }
    }
  })

  it('keeps the rear door locked with no rear-alley destination', () => {
    const rear = scene.passages.find(entry => entry.portalId === 'yonghe-back-door')!
    expect(rear.access).toBe('locked')
    expect(rear.targetSceneId).toBeUndefined()
    expect(scene.rooms.some(room => /alley/.test(room.id))).toBe(false)
  })

  it('keeps the historic eatery URL on the same complete map', () => {
    const legacy = mainlineScenes['yonghe-eatery']
    expect(legacy.rooms.map(room => room.id)).toEqual(scene.rooms.map(room => room.id))
    expect(legacy.passages.filter(passage => passage.routeThrough)).toHaveLength(8)
  })

  it('resolves the same entrance while deep inside an authorized room', () => {
    for (const candidate of [scene, mainlineScenes['yonghe-eatery']]) {
      const room = candidate.rooms.find(entry => entry.id === 'mining-shop-2-interior')!
      const deep = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
      expect(activeStorefrontInteriorOwner(candidate, deep)).toBe('yonghe-slot-2')
      expect(activeStorefrontPresentationOwner(candidate, deep)).toBeNull()
    }
  })
})
