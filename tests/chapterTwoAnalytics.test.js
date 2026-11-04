import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildAnalyticsEvent } from '../src/services/analytics.js'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const dependencies = {
  visitorId: '00000000-0000-0000-0000-000000000001',
  session: { id: '00000000-0000-0000-0000-000000000002', sequence: 0, milestones: [] },
  clientEventId: '00000000-0000-0000-0000-000000000003',
}

describe('Chapter Two commercial analytics contract', () => {
  it('accepts the final three-character storefront names emitted by the restored commercial street', () => {
    const labels = [
      '\u679c\u8336\u5e97', '\u6587\u521b\u5e97', '\u7f8e\u5986\u5e97', '\u773c\u955c\u5e97', '\u73a9\u5177\u5e97', '\u9999\u6c1b\u5e97', '\u5496\u5561\u9986',
      '\u6f6e\u724c\u5e97', '\u5feb\u9910\u5e97', '\u670d\u88c5\u5e97', '\u5976\u8336\u5e97', '\u751c\u54c1\u5e97', '\u73e0\u5b9d\u5e97',
    ]
    const events = labels.map((storeType, index) => buildAnalyticsEvent('commercial_storefront_interacted', {
      sceneId: 'commercial-street',
      eventData: { slotId: 'commercial-north-slot-2', storeType },
    }, { ...dependencies, clientEventId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}` }))
    expect(events.map(event => event?.event_data.storeType)).toEqual(labels)
  })

  it('keeps milk-tea order data structured and rejects arbitrary payload text', () => {
    const confirmed = buildAnalyticsEvent('milk_tea_order_confirmed', {
      sceneId: 'commercial-street',
      eventData: { drink: '芋泥奶茶', sugar: '少糖', ice: '去冰', orderNumber: 37, queueAheadAtOrder: 4 },
    }, dependencies)
    expect(confirmed?.event_data).toEqual({ drink: '芋泥奶茶', sugar: '少糖', ice: '去冰', orderNumber: 37, queueAheadAtOrder: 4 })

    const rejected = buildAnalyticsEvent('milk_tea_order_confirmed', {
      eventData: { drink: '任意输入', sugar: '少糖', ice: '去冰', orderNumber: 37, queueAheadAtOrder: 4, freeText: '不要记录我写的内容' },
    }, { ...dependencies, clientEventId: '00000000-0000-0000-0000-000000000004' })
    expect(rejected?.event_data).toEqual({})
  })

  it('aligns all Chapter Two event names between the client, Center owners, and repo-local migration', () => {
    const analytics = read('../src/services/analytics.js')
    const experience = read('../src/center/CenterExperience.jsx')
    const scene = read('../src/center/runtime/MainlineScenePage.tsx')
    const migration = read('../supabase/migrations/20260930030935_chapter_two_commercial_analytics.sql')
    for (const eventName of [
      'commercial_street_entered', 'commercial_question_triggered', 'commercial_question_completed',
      'commercial_storefront_interacted', 'milk_tea_app_unlocked', 'milk_tea_order_started',
      'milk_tea_order_confirmed', 'milk_tea_order_ready', 'milk_tea_order_picked_up',
      'cafe_storefront_revealed', 'cafe_entered', 'cafe_story_stage_reached',
      'cafe_coffee_ordered', 'cafe_ready_to_leave', 'cafe_completed',
    ]) {
      expect(analytics).toContain(`'${eventName}'`)
      expect(migration).toContain(`'${eventName}'`)
    }
    expect(migration).toContain('event_data jsonb')
    expect(analytics).not.toContain("'cafe_banknote_presented'")
    expect(migration).toContain("'cafe_banknote_presented'")
    expect(experience).toContain("trackEvent('commercial_street_entered'")
    expect(scene).toContain("onChapterAnalytics?.('commercial_question_triggered'")
    expect(scene).toContain("onChapterAnalytics?.('cafe_ready_to_leave'")
  })
})
