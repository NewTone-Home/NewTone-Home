/** Product reference data only. This catalog is intentionally not wired to the phone or order flow. */
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
  name: string
  price: number
  customization: DrinkCustomization
  description: string | null
  recommendation: { mood: string; line: string } | null
}

const teaCustomization: DrinkCustomization = { sugar: drinkCustomizationOptions.sugar, ice: drinkCustomizationOptions.ice }
const juiceCustomization: DrinkCustomization = { sugar: null, ice: drinkCustomizationOptions.ice }

export const commercialStreetDrinkCatalog: readonly CommercialStreetDrink[] = [
  { id: 'original-milk-tea', name: '原味奶茶', price: 3, customization: teaCustomization, description: '经典原味奶茶，茶香与奶香相互融合。', recommendation: null },
  { id: 'brown-sugar-pearl-milk-tea', name: '黑糖珍珠奶茶', price: 4, customization: teaCustomization, description: '浓郁黑糖风味，加入Q弹珍珠，甜香十足。', recommendation: null },
  { id: 'taro-milk-tea', name: '芋泥奶茶', price: 4, customization: teaCustomization, description: '加入细腻芋泥，奶香中带着淡淡芋香。', recommendation: { mood: '浓郁', line: '芋泥奶茶会浓郁一些。' } },
  { id: 'jasmine-milk-green-tea', name: '茉莉奶绿', price: 3, customization: teaCustomization, description: '清新的茉莉茶香与奶香融合，口感轻盈。', recommendation: { mood: '清爽', line: '可以试试茉莉奶绿，茶香比较清爽。' } },
  { id: 'passionfruit-green-tea', name: '百香果绿茶', price: 4, customization: teaCustomization, description: null, recommendation: null },
  { id: 'grape-jasmine-tea', name: '葡萄茉莉', price: 4, customization: teaCustomization, description: null, recommendation: null },
  { id: 'fresh-orange-juice', name: '鲜橙汁', price: 4, customization: juiceCustomization, description: null, recommendation: null },
  { id: 'strawberry-fruit-drink', name: '草莓果饮', price: 5, customization: juiceCustomization, description: null, recommendation: null },
] as const

export const commercialStreetDrinkShopDialogue = {
  welcome: '欢迎光临，看看想喝什么？',
  preferenceQuestion: '喜欢清爽一点，还是浓郁一点？',
} as const

export const commercialStreetDrinkCatalogMissingCopy = {
  descriptions: ['passionfruit-green-tea', 'grape-jasmine-tea', 'fresh-orange-juice', 'strawberry-fruit-drink'],
  recommendations: ['passionfruit-green-tea', 'grape-jasmine-tea', 'fresh-orange-juice', 'strawberry-fruit-drink'],
} as const
