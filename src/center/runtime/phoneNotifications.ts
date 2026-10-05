export type PhoneNotificationApp = 'ride' | 'milk-tea'
export type PhoneNotification = { id: string; app: PhoneNotificationApp; title: string; body: string; unread: boolean; presented: boolean }
export function cleanPhoneNotifications(value: unknown): PhoneNotification[] {
  if (!Array.isArray(value)) return []
  return value.filter((n): n is PhoneNotification => Boolean(n && typeof n.id === 'string' && (n.app === 'ride' || n.app === 'milk-tea') && typeof n.title === 'string' && typeof n.body === 'string'))
    .slice(-2).map(n => ({ id: n.id, app: n.app, title: n.title, body: n.body, unread: n.unread === true, presented: n.presented === true }))
}
/** One durable latest event per app; read/presented events retain their deduplication identity. */
export function enqueuePhoneNotification(current: readonly PhoneNotification[], event: Pick<PhoneNotification, 'id' | 'app' | 'title' | 'body'>): PhoneNotification[] {
  if (current.some(n => n.id === event.id)) return current as PhoneNotification[]
  return [...current.filter(n => n.app !== event.app), { ...event, unread: true, presented: false }]
}
export function presentPhoneNotifications(current: readonly PhoneNotification[]): PhoneNotification[] {
  return current.map(n => n.unread && !n.presented ? { ...n, presented: true } : n)
}
export function readPhoneNotifications(current: readonly PhoneNotification[], app: PhoneNotificationApp): PhoneNotification[] {
  return current.map(n => n.app === app && n.unread ? { ...n, unread: false, presented: true } : n)
}
