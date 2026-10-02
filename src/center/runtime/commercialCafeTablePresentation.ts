import type { MainlineSceneAttachedProp } from './mainlineSceneModel'

export type CommercialCafeAttachedPropLayout = {
  propId: string
  offsetXpx: number
  offsetYpx: number
  widthPx: number
  heightPx: number
}

const baseSizeByKind = {
  coffee: { width: 28, height: 28 },
  'milk-tea': { width: 24, height: 34 },
  banknote: { width: 38, height: 24 },
} as const

/**
 * Presentation-only placement for the Café story table. The table remains
 * the spatial owner; this resolver lays the currently visible items out in
 * screen pixels so item spacing is independent of scene geometry.
 */
export function resolveCommercialCafeTablePropLayout(
  visibleProps: readonly MainlineSceneAttachedProp[],
  viewportWidthPx: number,
): ReadonlyMap<string, CommercialCafeAttachedPropLayout> {
  if (visibleProps.length === 0) return new Map()
  const scale = Math.min(1.25, Math.max(.88, viewportWidthPx / 412))
  const count = visibleProps.length
  const hasLaoZhouCoffee = visibleProps.some((prop) => prop.id === 'commercial-cafe-lao-zhou-coffee')
  const hasXiujieCoffee = visibleProps.some((prop) => prop.id === 'commercial-cafe-xiujie-coffee')
  const hasMilkTea = visibleProps.some((prop) => prop.visualKind === 'milk-tea')
  const hasBanknote = visibleProps.some((prop) => prop.visualKind === 'banknote')
  const slotById = new Map<string, { x: number; y: number }>()
  const tableCenterlineOffset = 0
  const characterCupLateralOffset = baseSizeByKind.coffee.width
  const characterCupVerticalOffset = baseSizeByKind.coffee.height * (2 / 3)
  const innerCoffeeVerticalOffset = baseSizeByKind.coffee.height
  const outerCoffeeVerticalOffset = baseSizeByKind.coffee.height * 1.25
  const teaBesideThreePropOffset = characterCupLateralOffset + (baseSizeByKind.coffee.width + baseSizeByKind['milk-tea'].width) / 2
  const banknoteBesideThreePropOffset = characterCupLateralOffset + (baseSizeByKind.coffee.width + baseSizeByKind.banknote.width) / 2
  const outerPropLateralOffset = characterCupLateralOffset + baseSizeByKind['milk-tea'].width * (2 / 3)

  if (count === 1) {
    slotById.set(visibleProps[0]!.id, { x: 0, y: 0 })
  } else if (count === 2 && hasLaoZhouCoffee && hasXiujieCoffee) {
    // Keep the authored upper/lower character relationship, while moving
    // each cup off the seated actor label that occupies the same vertical
    // rail at the table edge.
    slotById.set('commercial-cafe-lao-zhou-coffee', { x: -characterCupLateralOffset, y: -characterCupVerticalOffset })
    slotById.set('commercial-cafe-xiujie-coffee', { x: characterCupLateralOffset, y: characterCupVerticalOffset })
  } else if (count === 2 && hasLaoZhouCoffee && hasMilkTea) {
    slotById.set('commercial-cafe-lao-zhou-coffee', { x: -21, y: 0 })
    slotById.set('commercial-cafe-xiujie-milk-tea', { x: 21, y: 0 })
  } else {
    const coffeeVerticalOffset = count === 4 ? outerCoffeeVerticalOffset : innerCoffeeVerticalOffset
    if (hasLaoZhouCoffee) slotById.set('commercial-cafe-lao-zhou-coffee', { x: -characterCupLateralOffset, y: -coffeeVerticalOffset })
    if (hasXiujieCoffee) slotById.set('commercial-cafe-xiujie-coffee', { x: characterCupLateralOffset, y: coffeeVerticalOffset })
    if (hasMilkTea) slotById.set('commercial-cafe-xiujie-milk-tea', { x: count === 4 ? outerPropLateralOffset : teaBesideThreePropOffset, y: tableCenterlineOffset })
    if (hasBanknote) slotById.set('commercial-cafe-banknote', { x: count === 4 ? -outerPropLateralOffset : -banknoteBesideThreePropOffset, y: tableCenterlineOffset })
  }

  return new Map(visibleProps.flatMap((prop) => {
    const slot = slotById.get(prop.id)
    const size = prop.visualKind ? baseSizeByKind[prop.visualKind] : undefined
    if (!slot || !size) return []
    return [[prop.id, {
      propId: prop.id,
      offsetXpx: slot.x * scale,
      offsetYpx: slot.y * scale,
      widthPx: size.width * scale,
      heightPx: size.height * scale,
    }] as const]
  }))
}
