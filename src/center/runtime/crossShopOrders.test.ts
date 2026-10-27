import { describe, expect, it } from 'vitest'
import { createInitialPlayerSave, loadPlayerSave, sanitizePlayerSave, savePlayerSave } from './playerSave'
import { commercialCafeTakeawayCatalog, commercialCafeTakeawayStoreId } from './commercialCafeTakeawayCatalog'
import { commercialStreetDrinkCatalogWithStores } from './commercialStreetDrinkCatalog'
import { mainlineSceneBlueprints } from './mainlineSceneModel'
import {
  cancelUnmappedLegacyOrder, claimCrossShopOrder, consumeHeldConsumable, crossShopIds, emptyCrossShopOrderState,
  mapLegacyOrderToGameTime, migrateLegacyShopState, placeCrossShopOrder, sanitizeCrossShopOrderState,
} from './crossShopOrders'
import {
  commercialStreetMilkTeaDrinkKey, commercialStreetMilkTeaHeldDrinkKey,
  commercialStreetMilkTeaCreatedAtKey, commercialStreetMilkTeaIceKey, commercialStreetMilkTeaOrderNumberKey,
  commercialStreetMilkTeaReadyAtKey, commercialStreetMilkTeaSugarKey,
} from './commercialStreetMilkTea'

function place(state: ReturnType<typeof sanitizeCrossShopOrderState>, shopId: string, id: string) {
  const result = placeCrossShopOrder(state, { shopId, id, productId: 'product-under-test', placedAtGameTimeMs: 10_000, preparationDurationMs: 5_000 })
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

describe('cross-shop order and global hand model', () => {
  it('allows one active order per shop while allowing orders at different shops', () => {
    const first = place(emptyCrossShopOrderState, crossShopIds.milkTea, 'milk-1')
    const duplicate = placeCrossShopOrder(first, { shopId: crossShopIds.milkTea, id: 'milk-2', productId: 'tea', placedAtGameTimeMs: 11, preparationDurationMs: 3 })
    expect(duplicate.ok ? null : duplicate.reason).toBe('shop-already-has-order')
    const second = placeCrossShopOrder(first, { shopId: crossShopIds.yonghe, id: 'meal-1', productId: 'wonton', placedAtGameTimeMs: 10_000, preparationDurationMs: 5_000 })
    expect(second.ok).toBe(true)
    if (second.ok) expect(Object.keys(second.state.ordersByShop)).toEqual([crossShopIds.milkTea, crossShopIds.yonghe])
  })

  it('binds the four fruit drinks to a separate fruit shop, while the four milk teas stay at their own shop', () => {
    expect(crossShopIds.milkTea).toBe('commercial-south-slot-5')
    expect(crossShopIds.fruitTea).toBe('commercial-north-slot-1')
    expect(commercialStreetDrinkCatalogWithStores.slice(0, 4).every(item => item.storeId === crossShopIds.milkTea)).toBe(true)
    expect(commercialStreetDrinkCatalogWithStores.slice(4).every(item => item.storeId === crossShopIds.fruitTea)).toBe(true)
    const street = mainlineSceneBlueprints['commercial-street']
    const fruitFrontage = street.scene.storefronts?.find(slot => slot.id === crossShopIds.fruitTea)
    expect(fruitFrontage?.portalId).toBeTruthy()
    const fruitInterior = street.portals.find(portal => portal.id === fruitFrontage?.portalId)
    expect(fruitInterior?.toRoomId).toBe('commercial-north-n1-interior')
    const milk = placeCrossShopOrder(emptyCrossShopOrderState, { shopId: crossShopIds.milkTea, id: 'milk', productId: 'original-milk-tea', placedAtGameTimeMs: 1_000, preparationDurationMs: 1 })
    if (!milk.ok) throw new Error(milk.reason)
    const fruit = placeCrossShopOrder(milk.state, { shopId: crossShopIds.fruitTea, id: 'fruit', productId: 'fresh-orange-juice', placedAtGameTimeMs: 1_000, preparationDurationMs: 1 })
    expect(fruit.ok).toBe(true)
  })

  it('provides the approved cafe takeaway SKU IDs and prices without touching narrative coffee', () => {
    expect(commercialCafeTakeawayCatalog.map(({ id, name, price, storeId }) => [id, name, price, storeId])).toEqual([
      ['americano', '美式', 5, commercialCafeTakeawayStoreId],
      ['latte', '拿铁', 5, commercialCafeTakeawayStoreId],
      ['flat-white', '澳白', 5, commercialCafeTakeawayStoreId],
      ['caramel-macchiato', '焦糖玛奇朵', 7, commercialCafeTakeawayStoreId],
      ['sea-salt-caramel-latte', '海盐焦糖拿铁', 7, commercialCafeTakeawayStoreId],
    ])
  })

  it('leaves an order untouched on a full hand, then allows claim after voluntary consume', () => {
    let state = place(emptyCrossShopOrderState, crossShopIds.milkTea, 'tea-1')
    const secondOrder = placeCrossShopOrder(state, { shopId: crossShopIds.yonghe, id: 'meal-1', productId: 'rice-box', placedAtGameTimeMs: 10_000, preparationDurationMs: 0 })
    if (!secondOrder.ok) throw new Error(secondOrder.reason)
    state = secondOrder.state
    const firstClaim = claimCrossShopOrder(state, crossShopIds.milkTea, 15_000)
    expect(firstClaim.ok).toBe(true)
    if (!firstClaim.ok) return
    const secondClaim = claimCrossShopOrder(firstClaim.state, crossShopIds.yonghe, 15_000, 'meal')
    expect(secondClaim).toMatchObject({ ok: false, reason: 'hand-full' })
    if (secondClaim.ok) return
    expect(secondClaim.state.ordersByShop[crossShopIds.yonghe]).toMatchObject({ id: 'meal-1' })
    expect(consumeHeldConsumable(firstClaim.state).ok).toBe(true)
    const consumed = consumeHeldConsumable(firstClaim.state)
    if (!consumed.ok) return
    const claimAfterConsume = claimCrossShopOrder(consumed.state, crossShopIds.yonghe, 15_000, 'meal')
    expect(claimAfterConsume).toMatchObject({ ok: true, value: { shopId: crossShopIds.yonghe, kind: 'meal' } })
  })

  it('keeps an unready order and rejects duplicate claim without mutating its state', () => {
    const state = place(emptyCrossShopOrderState, crossShopIds.yonghe, 'meal-1')
    const notReady = claimCrossShopOrder(state, crossShopIds.yonghe, 14_999, 'meal')
    expect(notReady).toMatchObject({ ok: false, reason: 'not-ready' })
    const claimed = claimCrossShopOrder(state, crossShopIds.yonghe, 15_000, 'meal')
    expect(claimed.ok).toBe(true)
    if (!claimed.ok) return
    expect(claimCrossShopOrder(claimed.state, crossShopIds.yonghe, 15_000, 'meal')).toMatchObject({ ok: false, reason: 'no-order' })
  })

  it('persists pending orders and the one held item through save sanitization and reload', () => {
    let state = place(emptyCrossShopOrderState, crossShopIds.yonghe, 'meal-1')
    const claimed = claimCrossShopOrder(state, crossShopIds.yonghe, 15_000, 'meal')
    if (!claimed.ok) throw new Error(claimed.reason)
    state = place(claimed.state, crossShopIds.milkTea, 'tea-1')
    const save = createInitialPlayerSave()
    const fixtureStorage = {
      data: {} as Record<string, string>,
      getItem(key: string) { return this.data[key] ?? null },
      setItem(key: string, value: string) { this.data[key] = value },
      removeItem(key: string) { delete this.data[key] },
    }
    loadPlayerSave(fixtureStorage, save.currentSceneId) // Apply the normal one-time release cutover to the isolated fixture first.
    savePlayerSave({ ...save, shopOrders: state.ordersByShop, heldConsumable: claimed.value }, fixtureStorage, 77)
    const restored = loadPlayerSave(fixtureStorage, save.currentSceneId)
    expect(restored.shopOrders).toEqual(state.ordersByShop)
    expect(restored.heldConsumable).toEqual(claimed.value)
    expect(restored.gameTimeMs).toBe(save.gameTimeMs)
  })

  it('migrates an old save without touching unrelated scene progress, items, location, or game time', () => {
    const fresh = createInitialPlayerSave()
    const legacy: Record<string, unknown> = {
      ...fresh,
      currentSceneId: 'commercial-street',
      currentPosition: { x: 12, y: 34 },
      scenePositions: { 'commercial-street': { x: 12, y: 34 } },
      sceneState: { 'commercial-street': {
        [commercialStreetMilkTeaOrderNumberKey]: 4,
        [commercialStreetMilkTeaReadyAtKey]: 1_800_000_000_000,
        [commercialStreetMilkTeaHeldDrinkKey]: 'milk-tea',
        unrelatedQuestFlag: true,
        carriedStoryItem: 'kept',
      } },
    }
    delete legacy.gameTimeMs
    delete legacy.shopOrders
    delete legacy.heldConsumable
    const restored = sanitizePlayerSave(legacy, fresh.currentSceneId)
    expect(restored.gameTimeMs).toBe(fresh.gameTimeMs)
    expect(restored.currentPosition).toEqual({ x: 12, y: 34 })
    expect(restored.sceneState['commercial-street']?.unrelatedQuestFlag).toBe(true)
    expect(restored.sceneState['commercial-street']?.carriedStoryItem).toBe('kept')
    expect(restored.shopOrders[crossShopIds.milkTea]).toMatchObject({
      status: 'queued', placedAtGameTimeMs: fresh.gameTimeMs, readyAtGameTimeMs: fresh.gameTimeMs + 900_000,
    })
    expect(restored.heldConsumable?.kind).toBe('legacy-unknown')
  })

  it('uses a valid saved game-time value without adding wall-clock time', () => {
    const base = createInitialPlayerSave()
    const restored = sanitizePlayerSave({ ...base, gameTimeMs: 987_654_321, updatedAt: Date.now() + 9_000_000 }, base.currentSceneId)
    expect(restored.gameTimeMs).toBe(987_654_321)
  })

  it('migrates old local-held state and retains legacy order timestamps without comparing them to game time', () => {
    const migrated = migrateLegacyShopState({ 'commercial-street': {
      [commercialStreetMilkTeaOrderNumberKey]: 7,
      [commercialStreetMilkTeaDrinkKey]: 'old-drink',
      [commercialStreetMilkTeaSugarKey]: 'old-sugar',
      [commercialStreetMilkTeaIceKey]: 'old-ice',
      [commercialStreetMilkTeaReadyAtKey]: 1_800_000_000_000,
      [commercialStreetMilkTeaHeldDrinkKey]: 'milk-tea',
      [commercialStreetMilkTeaCreatedAtKey]: 1_799_999_975_000,
    } }, { gameTimeMs: 600_000, updatedAtWallMs: 1_799_999_990_000 })
    const order = migrated.ordersByShop[crossShopIds.milkTea]
    expect(order).toMatchObject({ status: 'queued', placedAtGameTimeMs: 600_000, readyAtGameTimeMs: 900_000 })
    expect(order.legacySnapshot?.[commercialStreetMilkTeaReadyAtKey]).toBe(1_800_000_000_000)
    expect(migrated.heldConsumable).toMatchObject({ productId: 'legacy-milk-tea', kind: 'legacy-unknown' })
    expect(claimCrossShopOrder(migrated, crossShopIds.milkTea, Number.MAX_SAFE_INTEGER)).toMatchObject({ ok: false, reason: 'hand-full' })
  })

  it('keeps a timestamp-incomplete legacy order and offers explicit game-time resolution', () => {
    const unresolved = migrateLegacyShopState({ 'commercial-street': {
      [commercialStreetMilkTeaOrderNumberKey]: 8,
      [commercialStreetMilkTeaReadyAtKey]: 1_800_000_000_000,
    } }, { gameTimeMs: Number.NaN, updatedAtWallMs: 1_800_000_000_000 })
    expect(unresolved.ordersByShop[crossShopIds.milkTea]).toMatchObject({ status: 'legacy-unmapped' })
    const resolved = mapLegacyOrderToGameTime(unresolved, crossShopIds.milkTea, 42_000, 12_000)
    expect(resolved).toMatchObject({ ok: true, value: { status: 'queued', placedAtGameTimeMs: 42_000, readyAtGameTimeMs: 54_000 } })
  })

  it('releases an unmapped legacy shop slot only after explicit cancellation and preserves other shops', () => {
    const unresolved = migrateLegacyShopState({ 'commercial-street': {
      [commercialStreetMilkTeaOrderNumberKey]: 9,
      [commercialStreetMilkTeaReadyAtKey]: 1_800_000_000_000,
    } }, { gameTimeMs: Number.NaN, updatedAtWallMs: 1_800_000_000_000 })
    const withOtherOrder = place(unresolved, crossShopIds.fruitTea, 'fruit-1')
    expect(cancelUnmappedLegacyOrder(withOtherOrder, crossShopIds.fruitTea)).toMatchObject({ ok: false, reason: 'invalid-order' })
    const cancelled = cancelUnmappedLegacyOrder(withOtherOrder, crossShopIds.milkTea)
    expect(cancelled).toMatchObject({ ok: true, value: { status: 'legacy-unmapped', legacySnapshot: { [commercialStreetMilkTeaOrderNumberKey]: 9 } } })
    if (!cancelled.ok) throw new Error('expected legacy cancellation to succeed')
    expect(cancelled.state.ordersByShop[crossShopIds.milkTea]).toBeUndefined()
    expect(cancelled.state.ordersByShop[crossShopIds.fruitTea]).toMatchObject({ id: 'fruit-1', status: 'queued' })
  })

  it('drops malformed saved commerce records safely and does not invent a legacy order from a partial selection', () => {
    expect(sanitizeCrossShopOrderState({ ordersByShop: { shop: { shopId: 'other', id: 'x', productId: 'y', status: 'queued', placedAtGameTimeMs: 0, readyAtGameTimeMs: 2 } }, heldConsumable: { id: 2 } }))
      .toEqual(emptyCrossShopOrderState)
    const migrated = migrateLegacyShopState({ 'commercial-street': {
      [commercialStreetMilkTeaDrinkKey]: 'only-selection',
      [commercialStreetMilkTeaOrderNumberKey]: null,
      [commercialStreetMilkTeaHeldDrinkKey]: null,
    } }, { gameTimeMs: 0, updatedAtWallMs: 0 })
    expect(migrated).toEqual(emptyCrossShopOrderState)
  })
})
