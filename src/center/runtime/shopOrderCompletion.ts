import type { CrossShopOrder } from './crossShopOrders'
import { enqueuePhoneNotification, type PhoneNotification } from './phoneNotifications'
import { shopOrderNotificationFor } from './shopOrderCatalog'

export function notifyDueShopOrders(
  orders: Readonly<Record<string, CrossShopOrder>>,
  notifications: readonly PhoneNotification[],
  gameTimeMs: number,
): { orders: Record<string, CrossShopOrder>; notifications: PhoneNotification[]; changed: boolean } {
  if (!Number.isFinite(gameTimeMs) || gameTimeMs < 0) return { orders: orders as Record<string, CrossShopOrder>, notifications: notifications as PhoneNotification[], changed: false }
  let nextOrders = orders as Record<string, CrossShopOrder>
  let nextNotifications = notifications as PhoneNotification[]
  let changed = false
  for (const [shopId, order] of Object.entries(orders)) {
    if (order.status !== 'queued' || order.completionNotified === true
      || order.readyAtGameTimeMs === null || gameTimeMs < order.readyAtGameTimeMs) continue
    if (!changed) nextOrders = { ...orders }
    nextOrders[shopId] = { ...order, completionNotified: true }
    nextNotifications = enqueuePhoneNotification(nextNotifications, {
      id: `shop-order-ready:${order.id}`,
      ...shopOrderNotificationFor(shopId, order.productId),
    })
    changed = true
  }
  return { orders: nextOrders, notifications: nextNotifications, changed }
}
