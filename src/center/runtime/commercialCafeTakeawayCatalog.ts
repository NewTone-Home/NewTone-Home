/** Approved takeaway coffee SKUs. Narrative table-side coffee remains in commercialCafeStory. */
export const commercialCafeTakeawayStoreId = 'commercial-cafe-slot'

export const commercialCafeTakeawayCatalog = [
  { id: 'americano', name: '美式', price: 3, storeId: commercialCafeTakeawayStoreId },
  { id: 'latte', name: '拿铁', price: 4, storeId: commercialCafeTakeawayStoreId },
  { id: 'flat-white', name: '澳白', price: 4, storeId: commercialCafeTakeawayStoreId },
  { id: 'caramel-macchiato', name: '焦糖玛奇朵', price: 5, storeId: commercialCafeTakeawayStoreId },
  { id: 'sea-salt-caramel-latte', name: '海盐焦糖拿铁', price: 5, storeId: commercialCafeTakeawayStoreId },
] as const
