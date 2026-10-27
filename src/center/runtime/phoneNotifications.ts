export type PhoneNotificationApp = 'ride' | 'milk-tea' | 'yonghe-order' | 'cafe-takeaway'
export type PhoneNotification = { id: string; app: PhoneNotificationApp; shopId?: string; title: string; body: string; unread: boolean; presented: boolean }
const maxSavedNotifications = 6
/** Ordinary notifications do not own phone opening. */
export function phoneHasAutomaticNotification(_current: readonly PhoneNotification[]): boolean {
  return false
}
export function cleanPhoneNotifications(value: unknown): PhoneNotification[] {
  if (!Array.isArray(value)) return []
  return value.filter((n): n is PhoneNotification => Boolean(n && typeof n.id === 'string'
    && ['ride', 'milk-tea', 'yonghe-order', 'cafe-takeaway'].includes(n.app)
    && typeof n.title === 'string' && typeof n.body === 'string'))
    .slice(-maxSavedNotifications).map(n => ({ id: n.id, app: n.app, ...(typeof n.shopId === 'string' ? { shopId: n.shopId } : {}), title: n.title, body: n.body, unread: n.unread === true, presented: n.presented === true }))
}
/** One durable latest event per app; read/presented events retain their deduplication identity. */
export function enqueuePhoneNotification(current: readonly PhoneNotification[], event: Pick<PhoneNotification, 'id' | 'app' | 'title' | 'body'> & { shopId?: string }): PhoneNotification[] {
  if (current.some(n => n.id === event.id)) return current as PhoneNotification[]
  return [...current.filter(n => n.app !== event.app || (event.shopId && n.shopId && n.shopId !== event.shopId)), { ...event, unread: true, presented: false }].slice(-maxSavedNotifications)
}
export function presentPhoneNotifications(current: readonly PhoneNotification[]): PhoneNotification[] {
  return current.map(n => n.unread && !n.presented ? { ...n, presented: true } : n)
}
export function readPhoneNotifications(current: readonly PhoneNotification[], app: PhoneNotificationApp): PhoneNotification[] {
  return current.map(n => n.app === app && n.unread ? { ...n, unread: false, presented: true } : n)
}
