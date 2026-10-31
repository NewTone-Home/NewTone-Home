/** Manual Cafe recommendation copy and SKU mapping; SKU IDs come from the existing takeaway catalog. */
export const commercialCafeRecommendation = {
  question: '喜欢咖啡味重一点，还是奶味多一点？',
  preferences: [
    { id: 'coffee-forward', label: '咖啡味重一点', productId: 'americano' },
    { id: 'milk-forward', label: '奶味多一点', productId: 'latte' },
  ],
  acceptRecommendation: '就要这款',
  browseOtherCoffees: '看看其他咖啡',
} as const
