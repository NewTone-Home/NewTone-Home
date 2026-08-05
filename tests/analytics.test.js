import { describe, expect, it } from 'vitest'
import { buildAnalyticsEvent } from '../src/services/analytics'

describe('privacy-conscious analytics payload', () => {
  it('keeps only the constrained event dictionary', () => {
    const session = { id: '33333333-3333-4333-8333-333333333333', sequence: 0, milestones: [] }
    const event = buildAnalyticsEvent('beat_reached', {
      stepId: 'page-1:2', progressRatio: 1.4, rawText: 'must-not-leak', email: 'none@example.test',
    }, {
      visitorId: '11111111-1111-4111-8111-111111111111',
      clientEventId: '22222222-2222-4222-8222-222222222222', session,
    })
    expect(event.progress_ratio).toBe(1)
    expect(event.step_id).toBe('page-1:2')
    expect(event).not.toHaveProperty('rawText')
    expect(event).not.toHaveProperty('email')
    expect(buildAnalyticsEvent('arbitrary_event', {}, { session })).toBeNull()
  })
})
