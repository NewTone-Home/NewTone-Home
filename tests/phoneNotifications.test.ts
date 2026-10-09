import { expect, it } from 'vitest'
import { cleanPhoneNotifications, enqueuePhoneNotification, phoneHasAutomaticNotification, readPhoneNotifications } from '../src/center/runtime/phoneNotifications'
it('keeps ride unread durable without auto-opening while milk tea still auto-presents', () => {
  const ride = enqueuePhoneNotification([], { id: 'ride:one', app: 'ride', title: '司机已到达', body: '正在商业街口等你' })
  expect(phoneHasAutomaticNotification(ride)).toBe(false)
  expect(cleanPhoneNotifications(JSON.parse(JSON.stringify(ride)))).toEqual(ride)
  expect(enqueuePhoneNotification(ride, ride[0])).toBe(ride)
  const both = enqueuePhoneNotification(ride, { id: 'tea:one', app: 'milk-tea', title: '奶茶已制作完成', body: '可以去奶茶店取餐了' })
  expect(phoneHasAutomaticNotification(both)).toBe(true)
  const read = readPhoneNotifications(both, 'milk-tea')
  expect(phoneHasAutomaticNotification(read)).toBe(false)
  expect(read.find(n => n.app === 'ride')?.unread).toBe(true)
  expect(readPhoneNotifications(read, 'ride').every(n => !n.unread)).toBe(true)
})
