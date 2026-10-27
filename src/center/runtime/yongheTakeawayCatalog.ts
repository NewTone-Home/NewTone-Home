/** Stable SKU identifiers copied from the authored Yonghe order contract. */
export const yongheTakeawayShopId = 'yonghe-eatery'

export const yongheTakeawayCatalog = [
  { id: 'yonghe-fresh-pork-wontons', name: '\u9c9c\u8089\u9984\u9968', price: 12, storeId: yongheTakeawayShopId },
  { id: 'yonghe-minced-pork-noodles', name: '\u8089\u672b\u62cc\u9762', price: 11, storeId: yongheTakeawayShopId },
  { id: 'yonghe-egg-fried-rice', name: '\u86cb\u7092\u996d', price: 10, storeId: yongheTakeawayShopId },
  { id: 'yonghe-pork-and-greens-rice', name: '\u9752\u83dc\u8089\u7247\u76d6\u996d', price: 14, storeId: yongheTakeawayShopId },
] as const

export function yongheMenuText(products: readonly typeof yongheTakeawayCatalog[number][] = yongheTakeawayCatalog) {
  return products.map(({ name, price }) => `${name} ${price}元`).join('\n')
}

/** The choice narrows the existing menu without asserting a recommended dish. */
export function yongheMenuForChoice(choice: '面' | '饭') {
  return choice === '面'
    ? yongheTakeawayCatalog.filter(product => product.id === 'yonghe-minced-pork-noodles')
    : yongheTakeawayCatalog.filter(product => product.id === 'yonghe-egg-fried-rice' || product.id === 'yonghe-pork-and-greens-rice')
}
