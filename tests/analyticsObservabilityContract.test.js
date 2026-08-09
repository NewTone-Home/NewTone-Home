import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.jsx')
const main = read('../src/main.jsx')
const reader = read('../src/views/ReaderOrchestrator.jsx')
const analytics = read('../src/services/analytics.js')
const migration = read('../supabase/migrations/20260809195527_analytics_observability_v2.sql')
const dwellCheckpointMigration = read('../supabase/migrations/20260809202406_analytics_dwell_checkpoint_rollup.sql')

describe('analytics observability v2 wiring', () => {
  it('tracks the public funnel from Landing request through Reader structure and completion', () => {
    expect(app).toContain("trackEvent('reader_entry_requested'")
    expect(main).toContain("trackEvent('content_status'")
    expect(reader).toContain("trackEvent('reading_started'")
    expect(reader).toContain("trackEvent('page_entered'")
    expect(reader).toContain("trackEvent('chapter_entered'")
    expect(reader).toContain("trackEvent('beat_dwell'")
    expect(reader).toContain("trackEvent('chapter_completed'")
    expect(reader).toContain("trackEvent('reader_return'")
  })

  it('records Reader toolbar language/mode changes without tracking visual micro-interactions', () => {
    expect(reader).toContain("stepId: 'reader-tools'")
    expect(reader).toContain("trackEvent('language_selected'")
    expect(reader).toContain("trackEvent('mode_selected'")
    expect(analytics).not.toContain('pointer_move')
    expect(analytics).not.toContain('parallax_move')
  })

  it('keeps the staging database event dictionary aligned with the client dictionary', () => {
    for (const eventName of [
      'reader_entry_requested', 'page_entered', 'chapter_entered',
      'beat_dwell', 'chapter_completed', 'content_status',
    ]) {
      expect(analytics).toContain(`'${eventName}'`)
      expect(migration).toContain(`'${eventName}'`)
    }
    expect(app).toContain("exitReason: 'browser_back'")
    expect(analytics).toContain("'browser_back'")
    expect(migration).toContain("'browser_back'")
    expect(migration).toContain('private.analytics_step_dwell')
  })

  it('keeps dwell cumulative across reload checkpoints inside one browser session', () => {
    expect(analytics).toContain('visibleTotalMs')
    expect(dwellCheckpointMigration).toContain("max(sequence) filter (where event_name = 'session_end')")
    expect(dwellCheckpointMigration).toContain('last_session_end_sequence')
    expect(dwellCheckpointMigration).toContain("event_name = 'visibility_dwell'")
    expect(dwellCheckpointMigration).toContain('sequence > last_session_end_sequence')
    expect(dwellCheckpointMigration).toContain('coalesce(checkpoint_dwell_ms, 0)')
    expect(dwellCheckpointMigration).toContain('coalesce(dwell_after_checkpoint_ms, 0)')
  })
})
