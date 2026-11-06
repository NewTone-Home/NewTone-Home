// Called only after a successful authoritative save, never during an updater,
// hydration, replay, or notification rendering. No player text or order IDs leave the client.
const validObjectId = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(value)
export function shopAnalyticsTransitions(before, after) {
  const events = []
  const add = (name, shopId) => { if (validObjectId(shopId)) events.push({ name: 'center_interaction_completed', objectId: shopId, objectKind: 'shop', outcome: name }) }
  for (const [key, receipt] of Object.entries(after.shopOrderPaymentReceipts ?? {})) {
    if (!before.shopOrderPaymentReceipts?.[key]) add('order-submitted', receipt.shopId)
  }
  const held = after.heldConsumable, oldHeld = before.heldConsumable
  if (held?.sourceOrderId && held.id !== oldHeld?.id) add('order-collected', held.shopId)
  if (oldHeld && !held) add('item-consumed', oldHeld.shopId)
  return events
}
