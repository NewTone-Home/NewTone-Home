/** Authored Yonghe identifiers and order events for the separate cross-shop
 * ordering work. This file deliberately owns no wallet, save, or order state. */
export const yongheShopId = 'yonghe-eatery' as const

export const yongheMenu = [
  { sku: 'yonghe-fresh-pork-wontons', name: '\u9c9c\u8089\u9984\u9968', price: 12 },
  { sku: 'yonghe-minced-pork-noodles', name: '\u8089\u672b\u62cc\u9762', price: 11 },
  { sku: 'yonghe-egg-fried-rice', name: '\u86cb\u7092\u996d', price: 10 },
  { sku: 'yonghe-pork-and-greens-rice', name: '\u9752\u83dc\u8089\u7247\u76d6\u996d', price: 14 },
] as const

export type YongheSku = typeof yongheMenu[number]['sku']
export type YongheOrderEvent =
  | { type: 'placeCrossShopOrder'; shopId: typeof yongheShopId; sku: YongheSku }
  | { type: 'claimCrossShopOrder'; shopId: typeof yongheShopId; sku: YongheSku }

export const yongheInteractionCopy = {
  opening: '\u60f3\u5403\u70b9\u4ec0\u4e48\uff1f',
  options: ['\u70b9\u9910', '\u6709\u4ec0\u4e48\u63a8\u8350\u5417\uff1f', '\u804a\u804a'],
  ordered: '\u884c\uff0c\u4f60\u627e\u4e2a\u5730\u65b9\u5750\u4f1a\u513f\u5427\u3002',
  businessQuestion: '\u4f60\u4eec\u5e73\u5e38\u90fd\u8fd9\u4e48\u5fd9\u5417\uff1f',
  businessAnswer: '\u662f\u554a\uff0c\u5fd9\u8d77\u6765\u57fa\u672c\u6ca1\u4e2a\u505c\u3002',
  rearDoorQuestion: '\u540e\u9762\u90a3\u4e2a\u95e8\u662f\u901a\u5411\u54ea\u513f\u7684\uff1f',
  rearDoorAnswer: '\u540e\u9762\u901a\u7740\u540e\u5df7\uff0c\u987a\u7740\u8d70\u5c31\u80fd\u51fa\u53bb\u3002',
  recommendationQuestion: '\u60f3\u5403\u9762\uff0c\u8fd8\u662f\u5403\u996d\uff1f',
  recommendationOptions: ['\u9762', '\u996d'],
  warehousePush: '\u63a8\u4e00\u4e0b\u95e8',
  warehouseLocked: '\u95e8\u9501\u7740\uff0c\u6253\u4e0d\u5f00\u3002',
} as const
