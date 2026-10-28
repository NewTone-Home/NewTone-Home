/** Approved drink products used by wall menus, staff recommendations, and the shared ordering app. */
export const drinkCustomizationOptions = {
  sugar: ['少糖', '正常', '多糖'] as const,
  ice: ['少冰', '正常冰', '去冰'] as const,
} as const

export type DrinkCustomization = {
  sugar: typeof drinkCustomizationOptions.sugar | null
  ice: typeof drinkCustomizationOptions.ice
}

export type CommercialStreetDrink = {
  id: string
  storeId?: string
  name: string
  price: number
  customization: DrinkCustomization
  description: string | null
  recommendation: { mood: string; line: string } | null
}

const teaCustomization: DrinkCustomization = { sugar: drinkCustomizationOptions.sugar, ice: drinkCustomizationOptions.ice }
const juiceCustomization: DrinkCustomization = { sugar: null, ice: drinkCustomizationOptions.ice }

const drinkCatalogEntries: readonly CommercialStreetDrink[] = [
  { id: 'original-milk-tea', name: '原味奶茶', price: 3, customization: teaCustomization, description: '经典原味奶茶，茶香与奶香相互融合。', recommendation: null },
  { id: 'brown-sugar-pearl-milk-tea', name: '黑糖珍珠奶茶', price: 4, customization: teaCustomization, description: '浓郁黑糖风味，加入Q弹珍珠，甜香十足。', recommendation: null },
  { id: 'taro-milk-tea', name: '芋泥奶茶', price: 4, customization: teaCustomization, description: '加入细腻芋泥，奶香中带着淡淡芋香。', recommendation: { mood: '浓郁', line: '芋泥奶茶的口感会比较浓郁。' } },
  { id: 'jasmine-milk-green-tea', name: '茉莉奶绿', price: 3, customization: teaCustomization, description: '清新的茉莉茶香与奶香融合，口感轻盈。', recommendation: { mood: '清爽', line: '可以试试茉莉奶绿，花香比较清爽。' } },
  { id: 'passionfruit-green-tea', name: '百香果绿茶', price: 4, customization: teaCustomization, description: '百香果酸香，绿茶清爽', recommendation: { mood: '清爽', line: '可以试试百香果绿茶，酸香比较清爽。' } },
  { id: 'grape-jasmine-tea', name: '葡萄茉莉', price: 4, customization: teaCustomization, description: '葡萄果香，伴有茉莉花香', recommendation: null },
  { id: 'fresh-orange-juice', name: '鲜橙汁', price: 4, customization: juiceCustomization, description: '鲜橙酸甜，果香自然', recommendation: null },
  { id: 'strawberry-fruit-drink', name: '草莓果饮', price: 5, customization: juiceCustomization, description: '草莓香甜，果味浓郁', recommendation: { mood: '浓郁', line: '草莓果饮的果味会更浓郁一些。' } },
] as const

/** Explicit shop binding for the approved eight-SKU catalogue. */
export const commercialStreetDrinkCatalog = drinkCatalogEntries.map((product, index) => ({
  ...product,
  storeId: index < 4 ? 'commercial-south-slot-5' : 'commercial-north-slot-1',
})) as readonly (CommercialStreetDrink & { storeId: string })[]
export const commercialStreetDrinkCatalogWithStores = commercialStreetDrinkCatalog

/** Resolve only the two commercial tea shop staff/counter entities to their shared shop flow. */
export function commercialStreetDrinkShopForInteraction(entityId: string): string | null {
  switch (entityId) {
    case 'milk-tea-trial-worker':
    case 'milk-tea-trial-long-counter-0':
    case 'commercial-s5-milk-tea-order-service-label':
      return 'commercial-south-slot-5'
    case 'fruit-tea-trial-worker':
    case 'fruit-tea-trial-long-counter-0':
    case 'fruit-tea-trial-order':
      return 'commercial-north-slot-1'
    default:
      return null
  }
}

export const commercialStreetDrinkShopDialogue = {
  welcome: '欢迎光临，看看想喝什么？',
  recommendationRequest: '有什么推荐？',
  preferenceQuestion: '喜欢清爽一点，还是浓郁一点？',
  preferenceOptions: ['清爽一点', '浓郁一点'],
  recommendationOptions: ['就要这款', '看看其他饮品'],
} as const

export function recommendedCommercialStreetDrink(storeId: string, preference: string) {
  const productId = storeId === 'commercial-south-slot-5'
    ? preference === '清爽一点' ? 'jasmine-milk-green-tea' : 'taro-milk-tea'
    : preference === '清爽一点' ? 'passionfruit-green-tea' : 'strawberry-fruit-drink'
  return commercialStreetDrinkCatalog.find(product => product.id === productId) ?? null
}

export function commercialStreetDrinkMenuText(storeId: string) {
  return commercialStreetDrinkCatalog
    .filter(product => product.storeId === storeId)
    .map(product => `${product.name}  ${product.price}\n${product.description ?? ''}`)
    .join('\n')
}

export const commercialStreetDrinkCatalogMissingCopy = {
  descriptions: [],
  recommendations: ['original-milk-tea', 'brown-sugar-pearl-milk-tea', 'grape-jasmine-tea', 'fresh-orange-juice'],
} as const

