/** Canonical 16-module / 14-merchant registry for the rebuilt commercial street. */
export type CommercialStreetShop = {
  id: string
  storefrontIds: readonly string[]
  row: 'north' | 'south'
  firstModule: number
  moduleCount: 1 | 2
  kind: 'fruit-tea' | 'bookstore' | 'beauty' | 'glasses' | 'toys' | 'fragrance' | 'cafe' | 'shoes' | 'eatery' | 'clothing' | 'milk-tea' | 'dessert' | 'jewelry'
  label: { zh: string; en: string }
}

const north = (slot: number) => `commercial-north-slot-${slot}`
const south = (slot: number) => `commercial-south-slot-${slot}`

export const commercialStreetShops = [
  { id: 'commercial-fruit-tea', storefrontIds: [north(1)], row: 'north', firstModule: 1, moduleCount: 1, kind: 'fruit-tea', label: { zh: '果茶', en: 'Fruit Tea' } },
  { id: 'commercial-bookstore', storefrontIds: [north(2)], row: 'north', firstModule: 2, moduleCount: 1, kind: 'bookstore', label: { zh: '书店', en: 'Bookshop' } },
  { id: 'commercial-beauty', storefrontIds: [north(3)], row: 'north', firstModule: 3, moduleCount: 1, kind: 'beauty', label: { zh: '美妆', en: 'Beauty' } },
  { id: 'commercial-glasses', storefrontIds: [north(4)], row: 'north', firstModule: 4, moduleCount: 1, kind: 'glasses', label: { zh: '眼镜', en: 'Optical' } },
  { id: 'commercial-toys', storefrontIds: [north(5)], row: 'north', firstModule: 5, moduleCount: 1, kind: 'toys', label: { zh: '潮玩', en: 'Collectibles' } },
  { id: 'commercial-fragrance', storefrontIds: [north(6)], row: 'north', firstModule: 6, moduleCount: 1, kind: 'fragrance', label: { zh: '香氛', en: 'Fragrance' } },
  { id: 'commercial-cafe', storefrontIds: [north(7), north(8)], row: 'north', firstModule: 7, moduleCount: 2, kind: 'cafe', label: { zh: '咖啡馆', en: 'Cafe' } },
  { id: 'commercial-shoes', storefrontIds: [south(1)], row: 'south', firstModule: 1, moduleCount: 1, kind: 'shoes', label: { zh: '鞋店', en: 'Shoes' } },
  { id: 'commercial-eatery', storefrontIds: [south(2), south(3)], row: 'south', firstModule: 2, moduleCount: 2, kind: 'eatery', label: { zh: '简餐', en: 'Eatery' } },
  { id: 'commercial-clothing-west', storefrontIds: [south(4)], row: 'south', firstModule: 4, moduleCount: 1, kind: 'clothing', label: { zh: '服装', en: 'Clothing' } },
  { id: 'commercial-milktea', storefrontIds: [south(5)], row: 'south', firstModule: 5, moduleCount: 1, kind: 'milk-tea', label: { zh: '奶茶', en: 'Milk Tea' } },
  { id: 'commercial-dessert', storefrontIds: [south(6)], row: 'south', firstModule: 6, moduleCount: 1, kind: 'dessert', label: { zh: '甜品', en: 'Dessert' } },
  { id: 'commercial-jewelry', storefrontIds: [south(7)], row: 'south', firstModule: 7, moduleCount: 1, kind: 'jewelry', label: { zh: '首饰', en: 'Jewelry' } },
  { id: 'commercial-clothing-east', storefrontIds: [south(8)], row: 'south', firstModule: 8, moduleCount: 1, kind: 'clothing', label: { zh: '服装', en: 'Clothing' } },
] as const satisfies readonly CommercialStreetShop[]

export const commercialStreetModuleCount = 16
export const commercialStreetMerchantCount = commercialStreetShops.length
export const commercialStreetModulePitch = 22
export const commercialStreetShopDepth = 52
export const commercialStreetNorthStorefrontY = 36
export const commercialStreetSouthStorefrontY = 64

/**
 * The selected 52-unit room depth fits a public approach aisle, a service
 * counter/work strip, and a rear clearance inside each standard module. Two
 * adjacent modules share one room width and deliberately omit their divider.
 */
export function commercialStreetShopBounds(shop: CommercialStreetShop) {
  return {
    x: 12 + (shop.firstModule - 1) * commercialStreetModulePitch,
    y: shop.row === 'north'
      ? commercialStreetNorthStorefrontY - commercialStreetShopDepth
      : commercialStreetSouthStorefrontY,
    width: shop.moduleCount * commercialStreetModulePitch,
    height: commercialStreetShopDepth,
  }
}

export function commercialStreetShopEntry(shop: CommercialStreetShop) {
  const bounds = commercialStreetShopBounds(shop)
  const x = bounds.x + bounds.width / 2
  const doorX = x
  return {
    storefrontY: shop.row === 'north' ? commercialStreetNorthStorefrontY : commercialStreetSouthStorefrontY,
    x,
    doorX,
    crossingTarget: { x: doorX, y: shop.row === 'north' ? commercialStreetNorthStorefrontY - 5 : commercialStreetSouthStorefrontY + 5 },
    streetApproach: { x: doorX, y: shop.row === 'north' ? commercialStreetNorthStorefrontY + 2 : commercialStreetSouthStorefrontY - 2 },
  }
}

export function commercialStreetShopRegionId(shop: CommercialStreetShop) {
  return `${shop.id}-interior`
}

export function commercialStreetShopPortalId(shop: CommercialStreetShop) {
  if (shop.kind === 'cafe') return 'street-cafe-entry'
  if (shop.kind === 'milk-tea') return 'street-milktea-entry'
  return `street-shop-entry-${shop.id}`
}

export function commercialStreetShopForStorefront(storefrontId: string): CommercialStreetShop | undefined {
  return commercialStreetShops.find((shop) => shop.storefrontIds.includes(storefrontId))
}
