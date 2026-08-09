import { describe, expect, it } from 'vitest'
import { buildAnalyticsEvent } from '../src/services/analytics'

describe('privacy-conscious analytics payload', () => {
  const dependencies = (sequence = 0) => ({
    visitorId: '11111111-1111-4111-8111-111111111111',
    clientEventId: '22222222-2222-4222-8222-222222222222',
    session: { id: '33333333-3333-4333-8333-333333333333', sequence, milestones: [], visibleTotalMs: 0 },
  })

  it('keeps only the constrained event dictionary', () => {
    const event = buildAnalyticsEvent('beat_reached', {
      stepId: 'page-1:2', progressRatio: 1.4, rawText: 'must-not-leak', email: 'none@example.test',
    }, dependencies())
    expect(event.progress_ratio).toBe(1)
    expect(event.step_id).toBe('page-1:2')
    expect(event).not.toHaveProperty('rawText')
    expect(event).not.toHaveProperty('email')
    expect(buildAnalyticsEvent('arbitrary_event', {}, dependencies())).toBeNull()
  })

  it('accepts the observability v2 events without widening payload data', () => {
    for (const eventName of [
      'reader_entry_requested', 'page_entered', 'chapter_entered',
      'beat_dwell', 'chapter_completed', 'content_status',
    ]) {
      const event = buildAnalyticsEvent(eventName, {
        stepId: 'chapter:xiujie-1', language: 'zh', readingMode: 'immersive', dwellMs: 2500,
      }, dependencies())
      expect(event?.event_name).toBe(eventName)
      expect(event?.step_id).toBe('chapter:xiujie-1')
    }
  })

  it('preserves the normalized browser-back exit reason', () => {
    const event = buildAnalyticsEvent('reader_exit', { exitReason: 'browser_back' }, dependencies())
    expect(event?.exit_reason).toBe('browser_back')
  })
})
