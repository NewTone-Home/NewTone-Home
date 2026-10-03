import { describe, expect, it } from 'vitest'
import { buildAnalyticsEvent, getAnalyticsIdentity } from '../src/services/analytics'
import { resolveEntryBlockedStepId, resolveEntryStepExitReason, resolveEntryStepId } from '../src/hooks/useEntryFrictionTracking'

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
      'entry_step_shown', 'entry_step_dwell', 'entry_blocked', 'reader_checkpoint',
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

  it('keeps entry friction steps and completion meanings constrained', () => {
    expect(resolveEntryStepId('landing-leaving')).toBe('entry:landing-transition')
    expect(resolveEntryStepId('mode-active')).toBe('entry:mode')
    expect(resolveEntryStepExitReason('landing-leaving', 'reader-preparing')).toBe('completed')
    expect(resolveEntryStepExitReason('mode-active', 'idle')).toBe('abandoned')
    expect(resolveEntryBlockedStepId('language-leaving')).toBe('entry:language')
  })

  it('keeps an anonymous visitor across independent sessionStorage sessions', () => {
    const storage = () => {
      const values = new Map()
      return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
      }
    }
    const localStorage = storage()
    const first = getAnalyticsIdentity({ localStorage, sessionStorage: storage() })
    const second = getAnalyticsIdentity({ localStorage, sessionStorage: storage() })

    expect(first.visitorId).toBe(second.visitorId)
    expect(first.sessionId).not.toBe(second.sessionId)
  })

  it('records ordered trajectory facts with timestamps and strict world-coordinate payloads', () => {
    const session = dependencies(99_999).session
    const checkpoint = buildAnalyticsEvent('session_checkpoint', {
      sceneId: 'commercial-street',
      eventData: {
        elapsedMs: 50_001,
        foregroundMs: 40_000,
        engagedMs: 35_000,
        idleMs: 5_000,
        movementMs: 12_000,
        readingMs: 8_000,
        phoneMs: 3_000,
        freeText: 'must-not-leak',
      },
    }, { ...dependencies(), session, now: () => 1_800_000_000_000 })
    expect(checkpoint?.sequence).toBe(100_000)
    expect(checkpoint?.occurred_at).toBe('2027-01-15T08:00:00.000Z')
    expect(checkpoint?.event_data).toEqual({
      elapsedMs: 50_001,
      foregroundMs: 40_000,
      engagedMs: 35_000,
      idleMs: 5_000,
      movementMs: 12_000,
      readingMs: 8_000,
      phoneMs: 3_000,
    })
    const position = buildAnalyticsEvent('center_position_sample', {
      sceneId: 'office', positionX: 43.5, positionY: 51.25,
      eventData: { x: 'not-a-coordinate', freeText: 'must-not-leak' },
    }, dependencies())
    expect(position).toMatchObject({ position_x: 43.5, position_y: 51.25, event_data: {} })
    expect(buildAnalyticsEvent('center_position_sample', { positionX: 50000, positionY: 2 }, dependencies())).toBeNull()
    expect(buildAnalyticsEvent('center_interaction_requested', {
      sceneId: 'office', objectId: 'office-plant', objectKind: 'fixture', rawText: 'not collected',
    }, dependencies())).toMatchObject({ scene_id: 'office', object_id: 'office-plant', position_x: null, position_y: null })
  })
})
