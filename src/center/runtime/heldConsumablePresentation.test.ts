import { describe, expect, it } from 'vitest'
import { heldConsumablePresentation, isTrueMilkTea } from './heldConsumablePresentation'

describe('held consumable presentation', () => {
  it('shows known milk tea as a drink and reserves milk-tea-specific dialogue for that SKU', () => {
    const item = { id: 'held-1', shopId: 'commercial-south-slot-5', productId: 'original-milk-tea', kind: 'drink' as const, sourceOrderId: 'order-1' }
    expect(heldConsumablePresentation(item)).toMatchObject({ name: expect.any(String), action: 'drink', actionLabel: '喝掉', isMilkTea: true })
    expect(isTrueMilkTea(item)).toBe(true)
  })

  it('shows fruit tea as a drink but never marks it as milk tea', () => {
    const item = { id: 'held-2', shopId: 'commercial-north-slot-1', productId: 'passionfruit-green-tea', kind: 'drink' as const, sourceOrderId: 'order-2' }
    expect(heldConsumablePresentation(item)).toMatchObject({ action: 'drink', actionLabel: '喝掉', isMilkTea: false })
    expect(isTrueMilkTea(item)).toBe(false)
  })

  it('shows a Yonghe meal as food and labels the action eat', () => {
    const item = { id: 'held-3', shopId: 'yonghe-eatery', productId: 'yonghe-fresh-pork-wontons', kind: 'meal' as const, sourceOrderId: 'order-3' }
    expect(heldConsumablePresentation(item)).toMatchObject({ action: 'eat', actionLabel: '吃掉', isMilkTea: false })
    expect(isTrueMilkTea(item)).toBe(false)
  })

  it('keeps an unknown legacy drink generic without inventing a SKU name', () => {
    const item = { id: 'held-4', shopId: 'commercial-south-slot-5', productId: 'legacy-milk-tea', kind: 'legacy-unknown' as const, sourceOrderId: null }
    expect(heldConsumablePresentation(item)).toEqual({ name: '饮品', action: 'drink', actionLabel: '喝掉', isMilkTea: false })
    expect(isTrueMilkTea(item)).toBe(false)
  })
})
