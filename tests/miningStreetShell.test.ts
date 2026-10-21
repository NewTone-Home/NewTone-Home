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
  it('uses three facade wall cells on each side plus shared separators and the same fixed 25-interval Cafe depth', () => {
    for (const shop of miningShopShells) {
      const room = scene.rooms.find(r => r.id === shop.roomId)!
      expect(room.bounds.height / (28/1080*100)).toBeCloseTo(shop.letters + 7, 8)
      expect(room.bounds.width / (28/1920*100)).toBeCloseTo(25, 8)
    }
  })
  it('keeps three private walls per side plus one shared separator between neighboring signs', () => {
    const units = mainlineSceneGeometryUnits(scene, scene.initialPlayerPosition, sceneDesignReferenceMetrics, new Map(scene.storefronts.map(s => [s.id, 'baseline'])))
    const cells = units.filter(u => u.sourceWallId === 'mining-street-facade').flatMap(u => u.visual.cells)
    for (let index = 0; index < miningShopShells.length - 1; index++) {
      const a = miningShopShells[index]!, b = miningShopShells[index + 1]!
      const lastSign = a.firstCenter + (a.letters + 2) * miningGrid.vertical
      const nextSign = b.firstCenter + 3 * miningGrid.vertical
      const between = cells.filter(c => c.y > lastSign + .01 && c.y < nextSign - .01)
      const wallCenters = new Set(between.filter(c => c.kind === 'wall' || c.storefrontRole === 'wall').map(c => c.y.toFixed(2)))
      expect([...wallCenters], `${a.label} / ${b.label}`).toHaveLength(7)
    }
  })
  it('extends only the industrial boundary length while retaining its X, lane width and feature anchors', () => {
    const edge = scene.structures.find(wall => wall.id === 'mining-industrial-edge')!
    const lane = scene.rooms.find(room => room.id === 'mining-street-public-lane')!
    expect(lane.bounds.width * 1920 / 100).toBeCloseTo(168, 8)
    expect(edge.bounds!.x).toBeCloseTo(lane.bounds.x + lane.bounds.width, 8)
    const industrial = scene.geometry.filter(unit => unit.sourceWallId === edge.id).flatMap(unit => unit.visual.cells)
    for (const glyph of ['管', '线', '铁', '栅', '金', '属']) expect(industrial.filter(cell => cell.glyph === glyph)).toHaveLength(1)
    expect(scene.passages.find(p => p.id === 'yonghe-back-door')!.access).toBe('locked')
    const cafe = mainlineScenes['commercial-street'].rooms.find(room => room.id === 'commercial-north-cafe-interior')!
    for (const shop of miningShopShells) {
      const room = scene.rooms.find(room => room.id === shop.roomId)!
      expect(room.bounds.width * 1920).toBeCloseTo(cafe.bounds.height * 1080, 5)
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
