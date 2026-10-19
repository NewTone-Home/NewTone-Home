import { describe, expect, it } from 'vitest'
import { findMainlinePath, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { compileMainlineSceneSource, mainlineSceneRoute, mainlineScenes, resolveMainlineSceneId } from '../src/center/runtime/mainlineScenes'
import { commercialStreetContinuousWorldSourceBlueprint } from '../src/center/runtime/mainlineSceneModel'
import {
  commercialStreetMerchantCount,
  commercialStreetModuleCount,
  commercialStreetShopForStorefront,
  commercialStreetShopPortalId,
  commercialStreetShops,
} from '../src/center/runtime/commercialStreetWorldLayout'

const north = (slot: number) => `commercial-north-slot-${slot}`
const south = (slot: number) => `commercial-south-slot-${slot}`

const expectedShops = [
  { id: 'commercial-fruit-tea', slots: [north(1)], row: 'north', firstModule: 1, kind: 'fruit-tea', zh: '果茶', en: 'Fruit Tea' },
  { id: 'commercial-bookstore', slots: [north(2)], row: 'north', firstModule: 2, kind: 'bookstore', zh: '书店', en: 'Bookshop' },
  { id: 'commercial-beauty', slots: [north(3)], row: 'north', firstModule: 3, kind: 'beauty', zh: '美妆', en: 'Beauty' },
  { id: 'commercial-glasses', slots: [north(4)], row: 'north', firstModule: 4, kind: 'glasses', zh: '眼镜', en: 'Optical' },
  { id: 'commercial-toys', slots: [north(5)], row: 'north', firstModule: 5, kind: 'toys', zh: '潮玩', en: 'Collectibles' },
  { id: 'commercial-fragrance', slots: [north(6)], row: 'north', firstModule: 6, kind: 'fragrance', zh: '香氛', en: 'Fragrance' },
  { id: 'commercial-cafe', slots: [north(7), north(8)], row: 'north', firstModule: 7, kind: 'cafe', zh: '咖啡馆', en: 'Cafe' },
  { id: 'commercial-shoes', slots: [south(1)], row: 'south', firstModule: 1, kind: 'shoes', zh: '鞋店', en: 'Shoes' },
  { id: 'commercial-eatery', slots: [south(2), south(3)], row: 'south', firstModule: 2, kind: 'eatery', zh: '简餐', en: 'Eatery' },
  { id: 'commercial-clothing-west', slots: [south(4)], row: 'south', firstModule: 4, kind: 'clothing', zh: '服装', en: 'Clothing' },
  { id: 'commercial-milktea', slots: [south(5)], row: 'south', firstModule: 5, kind: 'milk-tea', zh: '奶茶', en: 'Milk Tea' },
  { id: 'commercial-dessert', slots: [south(6)], row: 'south', firstModule: 6, kind: 'dessert', zh: '甜品', en: 'Dessert' },
  { id: 'commercial-jewelry', slots: [south(7)], row: 'south', firstModule: 7, kind: 'jewelry', zh: '首饰', en: 'Jewelry' },
  { id: 'commercial-clothing-east', slots: [south(8)], row: 'south', firstModule: 8, kind: 'clothing', zh: '服装', en: 'Clothing' },
] as const

describe('commercial street world layout registry', () => {
  it('contains sixteen standard modules represented by fourteen merchants', () => {
    expect(commercialStreetModuleCount).toBe(16)
    expect(commercialStreetMerchantCount).toBe(14)
    expect(commercialStreetShops).toHaveLength(14)
  })

  it('assigns the two selected double-module storefront pairs to Café and the eatery only', () => {
    const doubleModuleShops = commercialStreetShops.filter((shop) => shop.moduleCount === 2)
    expect(doubleModuleShops.map(({ id, storefrontIds, row, firstModule }) => ({ id, storefrontIds, row, firstModule }))).toEqual([
      { id: 'commercial-cafe', storefrontIds: [north(7), north(8)], row: 'north', firstModule: 7 },
      { id: 'commercial-eatery', storefrontIds: [south(2), south(3)], row: 'south', firstModule: 2 },
    ])
    for (const shop of commercialStreetShops.filter((candidate) => candidate.moduleCount === 1)) {
      expect(shop.storefrontIds).toHaveLength(1)
    }
  })

  it('assigns every storefront and each row module exactly once, with the approved merchant and labels', () => {
    expect(commercialStreetShops.map(({ id, storefrontIds, row, firstModule, moduleCount, kind, label }) => ({
      id, storefrontIds, row, firstModule, moduleCount, kind, label,
    }))).toEqual(expectedShops.map(({ id, slots, row, firstModule, kind, zh, en }) => ({
      id,
      storefrontIds: slots,
      row,
      firstModule,
      moduleCount: slots.length,
      kind,
      label: { zh, en },
    })))

    const allStorefronts = [...commercialStreetShops.flatMap(({ storefrontIds }) => storefrontIds)]
    const expectedStorefronts = [...Array.from({ length: 8 }, (_, index) => north(index + 1)), ...Array.from({ length: 8 }, (_, index) => south(index + 1))]
    expect(allStorefronts).toHaveLength(16)
    expect(new Set(allStorefronts).size).toBe(16)
    expect([...allStorefronts].sort()).toEqual([...expectedStorefronts].sort())

    for (const storefrontId of expectedStorefronts) {
      const owners = commercialStreetShops.filter((shop) => shop.storefrontIds.includes(storefrontId))
      expect(owners).toHaveLength(1)
      expect(commercialStreetShopForStorefront(storefrontId)).toBe(owners[0])
    }

    for (const row of ['north', 'south'] as const) {
      const modules = commercialStreetShops
        .filter((shop) => shop.row === row)
        .flatMap((shop) => Array.from({ length: shop.moduleCount }, (_, offset) => shop.firstModule + offset))
      expect(modules).toHaveLength(8)
      expect(new Set(modules).size).toBe(8)
      expect([...modules].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    }
  })

  it('keeps all fourteen storefront doors visible but locked from the continuous street', () => {
    const street = mainlineScenes['commercial-street']
    for (const shop of commercialStreetShops) {
      const passage = street.passages.find(candidate => candidate.id === commercialStreetShopPortalId(shop))!
      const storefrontId = shop.kind === 'cafe' ? 'commercial-cafe-slot' : shop.storefrontIds[0]
      const storefront = street.storefronts.find(candidate => candidate.id === storefrontId)!
      expect(storefront.portalId, `${shop.id} storefront portal`).toBe(passage.id)
      expect(storefront.characterSwitch, `${shop.id} exposes an approach door`).toBe(true)
      expect(passage.access, `${shop.id} remains closed in this exterior-only phase`).toBe('locked')
      expect(passage.lockedText).toBe('本期暂未开放。')
      expect(street.geometry.some(unit => unit.ownerId === storefront.id
        && unit.entityId === passage.entityId
        && unit.visual.cells.some(cell => cell.kind === 'door' && cell.entityId === passage.entityId)), `${shop.id} door geometry`).toBe(true)
      const [outside, inside] = [passage.thresholds[0], passage.crossingTargets[0]]
      const closed = { actorId: 'protagonist', openPassageIds: new Set<string>() }
      expect(isWalkableMainlinePoint(outside, street, {}, closed), shop.id).toBe(true)
      expect(isWalkableMainlinePoint(inside, street, {}, closed), `${shop.id} crossing target`).toBe(false)
      expect(findMainlinePath(street.initialPlayerPosition, outside, street, {}, closed), shop.id).not.toBeNull()
    }
  }, 30_000)

  it('keeps Cafe interior as a region of the shared commercial-street runtime', () => {
    const street = mainlineScenes['commercial-street']
    const source = compileMainlineSceneSource(commercialStreetContinuousWorldSourceBlueprint)
    const passage = street.passages.find(candidate => candidate.id === 'street-cafe-entry')!

    expect(street.id).toBe('commercial-street')
    expect(mainlineScenes['commercial-cafe'].id).toBe('commercial-cafe')
    expect(resolveMainlineSceneId('?scene=commercial-cafe')).toBe('commercial-street')
    expect(mainlineSceneRoute('commercial-cafe')).toBe('/?scene=commercial-street')
    expect(mainlineScenes['commercial-milktea-interior']).toBe(street)
    expect(mainlineScenes['commercial-milktea-shop']).toBe(street)
    expect(passage.access).toBe('locked')
    expect(street.displayRegions).toEqual([])
    expect(source.objects.some(entity => entity.id === 'commercial-cafe-right-window-upper-group-table')).toBe(true)
    expect(source.objects.some(entity => entity.id === 'commercial-cafe-counter')).toBe(true)
    expect(source.accessRegions.some(region => region.id === 'commercial-cafe-staff-area')).toBe(true)
  })

  it('keeps lake entry and lakeside geometry out of the exterior runtime', () => {
    const street = mainlineScenes['commercial-street']
    expect(street.portals.some(candidate => candidate.id === 'commercial-street-lakefront-entry')).toBe(false)
    expect(street.passages.some(candidate => candidate.id === 'commercial-street-lakefront-entry')).toBe(false)
    expect(street.objects.some(entity => entity.id.startsWith('commercial-lakeside-'))).toBe(false)
    expect(street.geometry.some(unit => unit.id.includes('commercial-lakeside') || unit.id.includes('commercial-lakefront-street-gate'))).toBe(false)
    expect(street.walkBounds).toMatchObject({ x: 8, y: 36, width: 184, height: 28 })
  })
})
