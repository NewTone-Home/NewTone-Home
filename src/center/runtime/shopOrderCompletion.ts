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
  // A ready-notice only lives while its order is still waiting at the counter; Yonghe never uses the phone.
  const readyPrefix = 'shop-order-ready:'
  const activeOrderIds = new Set(Object.values(orders).map(order => order.id))
  const liveNotifications = notifications.filter(notification => notification.app !== 'yonghe-order'
    && (!notification.id.startsWith(readyPrefix) || activeOrderIds.has(notification.id.slice(readyPrefix.length))))
  let nextNotifications = liveNotifications as PhoneNotification[]
  let changed = liveNotifications.length !== notifications.length
  for (const [shopId, order] of Object.entries(orders)) {
    if (order.status !== 'queued' || order.completionNotified === true
      || order.readyAtGameTimeMs === null || gameTimeMs < order.readyAtGameTimeMs) continue
    if (nextOrders === orders) nextOrders = { ...orders }
    nextOrders[shopId] = { ...order, completionNotified: true }
    // Yonghe is not part of the phone order app; the owner tells the player in person.
    if (shopId !== 'yonghe-eatery') nextNotifications = enqueuePhoneNotification(nextNotifications, {
      id: `shop-order-ready:${order.id}`,
      ...shopOrderNotificationFor(shopId, order.productId),
    })
    changed = true
  }
  return { orders: nextOrders, notifications: nextNotifications, changed }
}
