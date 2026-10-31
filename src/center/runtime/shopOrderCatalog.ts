import { commercialCafeTakeawayCatalog } from './commercialCafeTakeawayCatalog'
import { commercialStreetDrinkCatalog } from './commercialStreetDrinkCatalog'
import { crossShopIds } from './crossShopOrders'
import { yongheTakeawayCatalog } from './yongheTakeawayCatalog'

const allShopProducts = [
  ...commercialStreetDrinkCatalog,
  ...commercialCafeTakeawayCatalog,
  ...yongheTakeawayCatalog,
]

export function shopProductFor(shopId: string, productId: string) {
  return allShopProducts.find(product => product.storeId === shopId && product.id === productId) ?? null
}

/** Returns the existing authored catalogue for one shop without copying SKU data. */
export function shopProductsFor(shopId: string) {
  return allShopProducts.filter(product => product.storeId === shopId)
}

export function shopOrderNotificationFor(shopId: string, productId: string) {
  const productName = shopProductFor(shopId, productId)?.name ?? productId
  const shopName = shopId === crossShopIds.milkTea ? '奶茶店'
    : shopId === crossShopIds.fruitTea ? '果茶店'
      : shopId === crossShopIds.cafeTakeaway ? 'Café'
        : shopId === crossShopIds.yonghe ? '永和小馆' : '店铺'
  const app = shopId === crossShopIds.milkTea || shopId === crossShopIds.fruitTea ? 'milk-tea'
    : shopId === crossShopIds.cafeTakeaway ? 'cafe-takeaway'
      : shopId === crossShopIds.yonghe ? 'yonghe-order' : 'milk-tea'
  return { app, shopId, title: `${shopName}订单已做好`, body: `${productName}已做好，可以到柜台领取。` } as const
}
