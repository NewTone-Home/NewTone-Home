import { describe, expect, it } from 'vitest'
import {
  mainlineDisplayRegionContains,
  mainlineDisplayRegionShowsGeometry,
  resolveMainlineDisplayRegion,
  resolveMainlineDisplayTransition,
  type MainlineSceneDisplayRegion,
} from '../src/center/runtime/sceneDisplayRegion'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialStreetShops } from '../src/center/runtime/commercialStreetWorldLayout'

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

  it('keeps the commercial street as one full-view world with all merchant facades', () => {
    const scene = mainlineScenes['commercial-street']
    expect(scene.displayRegions).toEqual([])
    expect(scene.storefronts).toHaveLength(commercialStreetShops.length)
    expect(scene.viewport).toBe('follow-player')
    expect(scene.structures.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'commercial-north-facade', 'commercial-main-lane', 'commercial-south-facade',
    ]))
  })
})
