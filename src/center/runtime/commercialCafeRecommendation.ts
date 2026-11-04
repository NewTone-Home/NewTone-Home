/** Manual Cafe recommendation copy and SKU mapping; SKU IDs come from the existing takeaway catalog. */
export const commercialCafeRecommendation = {
  question: '你喜欢咖啡味浓一点，还是奶味重一点？',
  preferences: [
    { id: 'coffee-forward', label: '咖啡味浓一点', productId: 'americano' },
    { id: 'milk-forward', label: '奶味重一点', productId: 'latte' },
  ],
  acceptRecommendation: '就要这款',
  browseOtherCoffees: '再看看其他咖啡',
} as const
