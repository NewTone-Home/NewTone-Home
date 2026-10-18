import { describe, expect, it } from 'vitest'
import {
  mainlineDisplayRegionContains,
  mainlineDisplayRegionShowsGeometry,
  resolveMainlineDisplayRegion,
  resolveMainlineDisplayTransition,
  type MainlineSceneDisplayRegion,
} from '../src/center/runtime/sceneDisplayRegion'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialStreetShopRegionId, commercialStreetShops } from '../src/center/runtime/commercialStreetWorldLayout'
import { resolveMainlineSafeSpawnPosition } from '../src/center/runtime/mainlineNavigation'

const regions: MainlineSceneDisplayRegion[] = [
  {
    id: 'street',
    bounds: { x: 0, y: 0, width: 100, height: 40 },
    visibleGeometryGroupIds: ['street', 'shared-frontage'],
    cameraAnchor: { x: 50, y: 20 },
    passageLinks: [{ passageId: 'shop-door', targetRegionId: 'shop' }],
  },
  {
    id: 'shop',
    bounds: { x: 0, y: 40, width: 100, height: 50 },
    visibleGeometryGroupIds: ['shop', 'shared-frontage'],
    cameraAnchor: { x: 50, y: 65 },
    passageLinks: [{ passageId: 'shop-door', targetRegionId: 'street' }],
  },
]

describe('mainline scene display regions', () => {
  it('resolves a world point and retains the current region on shared boundaries/outside bounds', () => {
    expect(resolveMainlineDisplayRegion(regions, { x: 14, y: 62 })?.id).toBe('shop')
    expect(resolveMainlineDisplayRegion(regions, { x: 14, y: 40 }, 'street')?.id).toBe('street')
    expect(resolveMainlineDisplayRegion(regions, { x: 180, y: 120 }, 'shop')?.id).toBe('shop')
    expect(resolveMainlineDisplayRegion(regions, { x: 180, y: 120 })).toBeNull()
  })

  it('changes the visible region only after a real passage crossing', () => {
    expect(resolveMainlineDisplayTransition(regions, 'street', 'shop-door', { crossed: false })?.id).toBe('street')
    expect(resolveMainlineDisplayTransition(regions, 'street', 'shop-door', { crossed: true })?.id).toBe('shop')
    expect(resolveMainlineDisplayTransition(regions, 'street', 'unknown-door', { crossed: true })?.id).toBe('street')
    expect(resolveMainlineDisplayTransition(regions, 'missing', 'shop-door', { crossed: true })).toBeNull()
  })

  it('treats the full authored region bounds as walkable display territory', () => {
    expect(mainlineDisplayRegionContains(regions[0]!, { x: 100, y: 40 })).toBe(true)
    expect(mainlineDisplayRegionContains(regions[0]!, { x: 100.01, y: 40 })).toBe(false)
  })

  it('allows adjacent regions to explicitly share a visible boundary group', () => {
    expect(mainlineDisplayRegionShowsGeometry(regions[0]!, 'shared-frontage')).toBe(true)
    expect(mainlineDisplayRegionShowsGeometry(regions[1]!, 'shared-frontage')).toBe(true)
    expect(mainlineDisplayRegionShowsGeometry(regions[0]!, 'shop')).toBe(false)
  })

  it('registers the commercial street as three continuous display regions with storefront owner groups', () => {
    const streetRegions = mainlineScenes['commercial-street'].displayRegions
    expect(streetRegions.map(region => region.id)).toEqual([
      'commercial-street-west', 'commercial-street-center', 'commercial-street-east',
      ...commercialStreetShops.map(commercialStreetShopRegionId),
      'commercial-lakeside',
    ])
    expect(resolveMainlineDisplayRegion(streetRegions, { x: 34, y: 50 })?.id).toBe('commercial-street-west')
    expect(resolveMainlineDisplayRegion(streetRegions, { x: 106, y: 50 })?.id).toBe('commercial-street-center')
    expect(resolveMainlineDisplayRegion(streetRegions, { x: 168, y: 50 })?.id).toBe('commercial-street-east')
    expect(streetRegions[0]!.visibleGeometryGroupIds).toContain('commercial-north-slot-1')
    expect(streetRegions[0]!.visibleGeometryGroupIds).not.toContain('commercial-north-slot-8')
    expect(streetRegions[2]!.visibleGeometryGroupIds).toContain('commercial-cafe-slot')
    for (const shop of commercialStreetShops) {
      const region = streetRegions.find(candidate => candidate.id === commercialStreetShopRegionId(shop))!
      expect(region.passageLinks).toHaveLength(1)
      expect(region.bounds.width).toBe(shop.moduleCount * 22)
      expect(region.bounds.height).toBe(shop.kind === 'cafe' ? 58 : 52)
    }
  })

  it('preserves a walkable resumed position inside its current shop region', () => {
    const scene = mainlineScenes['commercial-street']
    const migratedCafePosition = { x: 166.4889, y: 22 }
    const regionId = resolveMainlineDisplayRegion(scene.displayRegions, migratedCafePosition)?.id
    expect(regionId).toBe('commercial-cafe-interior')
    expect(resolveMainlineSafeSpawnPosition(scene, migratedCafePosition, {}, { displayRegionId: regionId })).toEqual(migratedCafePosition)
  })
})
