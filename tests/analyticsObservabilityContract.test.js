import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = read('../src/App.jsx')
const landing = read('../src/views/Landing.jsx')
const landingEntryAnalytics = read('../src/services/landingEntryAnalytics.js')
const main = read('../src/main.jsx')
const reader = read('../src/views/ReaderOrchestrator.jsx')
const analytics = read('../src/services/analytics.js')
const entryFriction = read('../src/hooks/useEntryFrictionTracking.js')
const migration = read('../supabase/migrations/20260809195527_analytics_observability_v2.sql')
const dwellCheckpointMigration = read('../supabase/migrations/20260809202406_analytics_dwell_checkpoint_rollup.sql')
const frictionMigration = read('../supabase/migrations/20260816043502_analytics_friction_diagnostics.sql')

describe('analytics observability v2 wiring', () => {
  it('tracks the public Center request while retaining Reader module events for author previews', () => {
    expect(app).toContain("trackEvent('center_entry_requested'")
    expect(app).toContain('landingObserver.current.observe(')
    expect(main).not.toContain('loadPublishedContent')
    expect(app).not.toContain("import Reader from")
    for (const name of ['reading_started', 'page_entered', 'chapter_entered', 'beat_dwell', 'chapter_completed', 'reader_return']) expect(reader).toContain(`trackEvent('${name}'`)
  })

  it('records Reader toolbar language/mode changes without tracking visual micro-interactions', () => {
    expect(reader).toContain("stepId: 'reader-tools'")
    expect(reader).toContain("trackEvent('language_selected'")
    expect(reader).toContain("trackEvent('mode_selected'")
    expect(analytics).not.toContain('pointer_move')
    expect(analytics).not.toContain('parallax_move')
  })

  it('records the displayed Landing language source and viewport metadata without hardware identifiers', () => {
    const observer = read('../src/services/landingEntryObserver.mjs')
    expect(app).toContain('landingObserver.current.observe(')
    expect(observer).toContain('trackLandingEntry')
    expect(landing).toContain('resolveDisplayedReaderLanguage({')
    expect(landingEntryAnalytics).toContain('resolveDisplayedReaderLanguage({')
    expect(analytics).toContain('device_category: deviceCategory')
    expect(analytics).toContain('viewport_width: width')
    expect(analytics).toContain('viewport_height: height')
    expect(analytics).toContain("['user_selected', 'browser_default', 'product_default']")
    for (const forbidden of ['navigator.userAgent', 'screen.width', 'screen.height']) expect(analytics).not.toContain(forbidden)
  })

  it('keeps the staging database event dictionary aligned with the client dictionary', () => {
    for (const eventName of [
      'reader_entry_requested', 'page_entered', 'chapter_entered',
      'beat_dwell', 'chapter_completed', 'content_status',
    ]) {
      expect(analytics).toContain(`'${eventName}'`)
      expect(migration).toContain(`'${eventName}'`)
    }
    expect(migration).toContain('private.analytics_step_dwell')
  })

  it('retains the legacy Reader browser-back vocabulary independently of public Center routing', () => {
    expect(analytics).toContain("'browser_back'")
    expect(migration).toContain("'browser_back'")
    expect(app).not.toContain('reader_entry_requested')
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

  it('records entry friction and Reader recovery points without widening the analytics payload', () => {
    for (const eventName of [
      'entry_step_shown', 'entry_step_dwell', 'entry_blocked', 'reader_checkpoint',
    ]) {
      expect(analytics).toContain(`'${eventName}'`)
      expect(frictionMigration).toContain(`'${eventName}'`)
    }
    expect(entryFriction).toContain("closeEntryStep('unload', true)")
    expect(reader).toContain("trackEvent('reader_checkpoint'")
    expect(reader).toContain('READER_CHECKPOINT_INTERVAL_MS')
    expect(frictionMigration).toContain('private.analytics_entry_friction')
    expect(frictionMigration).toContain('private.analytics_reader_last_position')
  })
})
