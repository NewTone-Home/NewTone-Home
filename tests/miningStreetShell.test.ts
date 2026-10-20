import { canTravelAlongMainlineSegment, isWalkableMainlinePoint, resolveMainlineWorldNavigation } from '../src/center/runtime/mainlineNavigation'
import { describe, expect, it } from 'vitest'
import { miningGrid, miningShopShells } from '../src/center/runtime/miningStreetShell'
import { mainlineCanonicalSceneGeometryUnits, mainlineSceneGeometryUnits, mainlineScenes, validateMainlineSceneGeometry } from '../src/center/runtime/mainlineScenes'
import { activeStorefrontInteriorOwner, activeStorefrontPresentationOwner, storefrontCharacterCells } from '../src/center/runtime/storefrontPresentation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const scene = mainlineScenes['yonghe-mining-perimeter']
describe('mining continuous empty shells', () => {
  it('compiles all eight rooms in the same scene without furniture or cross-scene shop doors', () => {
    expect(scene.rooms).toHaveLength(9)
    expect(scene.storefronts).toHaveLength(8)
    expect(scene.objects.filter(o => o.kind === 'table' || o.kind === 'seat')).toHaveLength(0)
    for (const shop of miningShopShells) {
      const passage = scene.passages.find(p => p.portalId === shop.portalId)!
      expect(passage).toMatchObject({ access: 'open', routeThrough: true, fromRoomId: 'mining-street-public-lane', toRoomId: shop.roomId })
      expect(passage.targetSceneId).toBeUndefined()
    }
    expect(validateMainlineSceneGeometry(scene)).toEqual([])
  })
  it('uses center-to-center width N+3 and twice that depth, counting intervals rather than anchors', () => {
    for (const shop of miningShopShells) {
      const room = scene.rooms.find(r => r.id === shop.roomId)!
      expect(room.bounds.height / miningGrid.vertical).toBeCloseTo(shop.letters + 3, 5)
      expect(room.bounds.width / miningGrid.horizontal).toBeCloseTo((shop.letters + 3) * 2, 5)
    }
  })
  it('keeps exactly three wall glyphs between the last sign of a shop and the first of its neighbor', () => {
    const units = mainlineSceneGeometryUnits(scene, scene.initialPlayerPosition, sceneDesignReferenceMetrics, new Map(scene.storefronts.map(s => [s.id, 'baseline'])))
    const cells = units.filter(u => u.sourceWallId === 'mining-street-facade').flatMap(u => u.visual.cells)
    for (let index = 0; index < miningShopShells.length - 1; index++) {
      const a = miningShopShells[index]!, b = miningShopShells[index + 1]!
      const lastSign = a.firstCenter + a.letters * miningGrid.vertical
      const nextSign = b.firstCenter + miningGrid.vertical
      const between = cells.filter(c => c.y > lastSign + .01 && c.y < nextSign - .01)
      const wallCenters = new Set(between.filter(c => c.kind === 'wall' || c.storefrontRole === 'wall').map(c => c.y.toFixed(2)))
      expect([...wallCenters], `${a.label} / ${b.label}`).toHaveLength(3)
    }
  })
  it('has no window/glass glyph roles in any shop state', () => {
    for (const unit of scene.geometry) for (const cell of unit.visual.cells) {
      expect(['glass', 'window']).not.toContain(cell.storefrontRole)
    }
  })
  it('projects 2/3/4 sign characters onto one real door and matching passage', () => {
    for (const slot of scene.storefronts) {
      const units = mainlineCanonicalSceneGeometryUnits(scene, sceneDesignReferenceMetrics)
      const cells = storefrontCharacterCells(scene, slot, units)
      expect(cells.map(c => c.baselineGlyph).join('')).toBe(slot.label)
      const doors = cells.filter(c => c.role === 'door')
      expect(doors).toHaveLength(1)
      const passage = scene.passages.find(p => p.portalId === slot.portalId)!
      expect(doors[0]!.entityId).toBe(passage.entityId)
      expect(doors[0]!.x).toBeCloseTo(passage.doorway.x + passage.doorway.width / 2, 2)
      expect(doors[0]!.y).toBeCloseTo(passage.doorway.y + passage.doorway.height / 2, 2)
    }
  })
  it('keeps the eatery rear door locked without a rear-alley destination', () => {
    const rear = scene.passages.find(p => p.portalId === 'yonghe-back-door')!
    expect(rear.access).toBe('locked')
    expect(rear.targetSceneId).toBeUndefined()
    expect(scene.rooms.some(r => /alley/.test(r.id))).toBe(false)
  })
  it('keeps the historic eatery URL on the complete empty shell map', () => {
    const legacy = mainlineScenes['yonghe-eatery']
    expect(legacy.rooms.map(r => r.id)).toEqual(scene.rooms.map(r => r.id))
    expect(legacy.passages.filter(p => p.routeThrough)).toHaveLength(8)
  })
  it('keeps the actual owning entrance while deep inside all eight shells on both scene URLs', () => {
    for (const candidate of [scene, mainlineScenes['yonghe-eatery']]) {
      for (const shop of miningShopShells) {
        const room = candidate.rooms.find(room => room.id === shop.roomId)!
        const deep = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
        expect(activeStorefrontInteriorOwner(candidate, deep), shop.label).toBe(shop.storefront.id)
        expect(activeStorefrontPresentationOwner(candidate, deep), shop.label).toBeNull()
      }
    }
  })
  it('walks the whole street and crosses every real doorway in both directions only when open', () => {
    for (const shop of miningShopShells) {
      const passage = scene.passages.find(p => p.portalId === shop.portalId)!
      const outside = { x: 40 + 2 * miningGrid.horizontal, y: shop.doorY }
      const inside = { x: 40 - 2 * miningGrid.horizontal, y: shop.doorY }
      const closed = { screenMetrics: sceneDesignReferenceMetrics, openPassageIds: new Set<string>() }
      const open = { ...closed, openPassageIds: new Set([passage.id]) }
      expect(resolveMainlineWorldNavigation(scene, scene.initialPlayerPosition, outside, {}, closed)?.reachedRequestedTarget, shop.label).toBe(true)
      expect(canTravelAlongMainlineSegment(outside, inside, scene, {}, closed), shop.label).toBe(false)
      expect(canTravelAlongMainlineSegment(outside, inside, scene, {}, open), shop.label).toBe(true)
      expect(canTravelAlongMainlineSegment(inside, outside, scene, {}, open), shop.label).toBe(true)
      expect(isWalkableMainlinePoint({x: (shop.back + 40) / 2, y: (shop.top + shop.bottom) / 2}, scene, {}, closed), shop.label).toBe(true)
    }
  })
})
