import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildAnalyticsEvent } from '../src/services/analytics.js'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

describe('Center minimal analytics contract', () => {
  it('keeps Center scene and interaction fields in the constrained event payload', () => {
    const payload = buildAnalyticsEvent('center_object_interacted', {
      sceneId: 'zhongshuyuan-office',
      objectId: 'zhongshuyuan-office-chair',
      objectKind: 'seat',
      dwellMs: 1840,
      outcome: 'revealed',
    }, {
      visitorId: '00000000-0000-0000-0000-000000000001',
      session: { id: '00000000-0000-0000-0000-000000000002', sequence: 2, milestones: [] },
      clientEventId: '00000000-0000-0000-0000-000000000003',
    })

    expect(payload).toMatchObject({
      event_name: 'center_object_interacted',
      scene_id: 'zhongshuyuan-office',
      object_id: 'zhongshuyuan-office-chair',
      object_kind: 'seat',
      dwell_ms: 1840,
      outcome: 'revealed',
    })
  })

  it('keeps the Center event dictionary and database migration aligned', () => {
    const analytics = read('../src/services/analytics.js')
    const experience = read('../src/center/CenterExperience.jsx')
    const scene = read('../src/center/runtime/MainlineScenePage.tsx')
    const migration = read('../supabase/migrations/20260912090000_center_analytics_minimal.sql')

    for (const eventName of [
      'center_entry_requested', 'center_scene_entered', 'center_scene_exited',
      'center_object_interacted', 'center_door_attempted', 'center_door_blocked',
      'center_door_crossed', 'center_phone_opened', 'center_ride_ready',
    ]) {
      expect(analytics).toContain(`'${eventName}'`)
      expect(migration).toContain(`'${eventName}'`)
    }
    expect(experience).toContain("trackEvent('center_scene_entered'")
    expect(experience).toContain("trackEvent('center_object_interacted'")
    expect(experience).toContain("trackEvent('center_ride_ready'")
    expect(scene).toContain("onDoorEvent?.('attempted'")
    expect(scene).toContain("onObjectInteraction?.(entity,")
  })
})
