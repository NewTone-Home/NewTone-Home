import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildAnalyticsEvent } from '../src/services/analytics'
import { trackLandingEntry } from '../src/services/landingEntryAnalytics'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const landing = readFileSync(new URL('../src/views/Landing.jsx', import.meta.url), 'utf8')
const readingTransition = readFileSync(new URL('../src/components/ReadingTransition.jsx', import.meta.url), 'utf8')

describe('Landing entry language analytics', () => {
  const dependencies = {
    visitorId: '11111111-1111-4111-8111-111111111111',
    clientEventId: '22222222-2222-4222-8222-222222222222',
    session: { id: '33333333-3333-4333-8333-333333333333', sequence: 0, milestones: [], visibleTotalMs: 0 },
    viewportWindow: null,
  }

  it.each([
    ['English browser first visit', { language: 'zh', hasInitializedLanguage: false }, ['en-US'], 'en', 'browser_default'],
    ['Chinese browser first visit', { language: 'zh', hasInitializedLanguage: false }, ['zh-CN'], 'zh', 'browser_default'],
    ['saved selection overrides browser language', { language: 'en', hasInitializedLanguage: true }, ['zh-CN'], 'en', 'user_selected'],
    ['unsupported browser language uses product fallback', { language: 'zh', hasInitializedLanguage: false }, ['fr-FR'], 'zh', 'product_default'],
  ])('%s is recorded with the language and source Landing displays', (_label, preferences, browserLanguages, language, source) => {
    const track = vi.fn()
    const displayed = trackLandingEntry(preferences, browserLanguages, track)
    expect(displayed).toEqual({ language, source })
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('landing_entry', {
      stepId: 'landing', language, eventData: { languageSource: source },
    })

    const event = buildAnalyticsEvent('landing_entry', track.mock.calls[0][1], dependencies)
    expect(event).toMatchObject({ language, event_data: { languageSource: source } })
  })

  it('shares the display resolver and tracks one event per Landing view without language rerender duplicates', () => {
    const trackSpy = vi.fn()
    const displayedLanguage = trackLandingEntry(
      { language: 'zh', hasInitializedLanguage: false }, ['en-GB'], trackSpy,
    )

    expect(trackSpy).toHaveBeenCalledTimes(1)
    expect(trackSpy).toHaveBeenCalledWith('landing_entry', {
      stepId: 'landing', language: 'en', eventData: { languageSource: 'browser_default' },
    })
    expect(displayedLanguage).toEqual({ language: 'en', source: 'browser_default' })
    expect(app.match(/trackLandingEntry\(/g)).toHaveLength(1)
    expect(app).toContain('trackLandingEntry(displayedPreferences, navigator.languages')
    expect(app).toContain('}, [currentView])')
    expect(landing).toContain('resolveDisplayedReaderLanguage({')
    expect(readingTransition).toContain('resolveDisplayedReaderLanguage({')
  })
})
