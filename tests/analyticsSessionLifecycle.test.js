import { beforeEach, describe, expect, it, vi } from 'vitest'

function createStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

async function loadAnalytics() {
  vi.resetModules()
  vi.doMock('../src/lib/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: null }))
  return import('../src/services/analytics.js')
}

describe('global analytics session activity ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_800_000_000_000)
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }))
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('localStorage', createStorage())
    vi.stubGlobal('sessionStorage', createStorage())
  })

  it('counts whole-app foreground input and Reader progress without collecting input content', async () => {
    const analytics = await loadAnalytics()
    const uninstall = analytics.installDwellTracking()
    document.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(10_000)
    analytics.trackReaderProgress('chapter:one', 0.2)
    const snapshot = analytics.getSessionActivitySnapshot()

    expect(snapshot).toMatchObject({ foregroundMs: 10_000, engagedMs: 10_000, idleMs: 0 })
    expect(snapshot).not.toHaveProperty('text')
    uninstall()
  })

  it('persists accumulated time across reload while resetting stale movement, Reading, and Phone state', async () => {
    let analytics = await loadAnalytics()
    const uninstall = analytics.installDwellTracking()
    analytics.setCenterMovementActive(true)
    vi.advanceTimersByTime(60_000)
    analytics.setCenterMovementActive(false)
    window.dispatchEvent(new Event('pagehide'))
    const beforeReload = analytics.getAnalyticsIdentity().activity
    uninstall()

    vi.advanceTimersByTime(40_000)
    analytics = await loadAnalytics()
    const secondUninstall = analytics.installDwellTracking()
    const resumed = analytics.getSessionActivitySnapshot()

    expect(resumed.elapsedMs).toBe(100_000)
    expect(resumed.foregroundMs).toBe(beforeReload.foregroundMs)
    expect(resumed.movementMs).toBe(60_000)
    expect(resumed.readingMs).toBe(0)
    expect(resumed.phoneMs).toBe(0)
    expect(resumed.moving).toBe(false)
    expect(resumed.reading).toBe(false)
    expect(resumed.phoneOpen).toBe(false)
    expect(analytics.getAnalyticsIdentity().activity).toMatchObject({
      startedAt: 1_800_000_000_000,
      lastAccountedAt: 1_800_000_060_000,
      lastMeaningfulActivityAt: expect.any(Number),
    })

    vi.advanceTimersByTime(10_000)
    expect(analytics.getSessionActivitySnapshot()).toMatchObject({
      elapsedMs: 110_000,
      foregroundMs: beforeReload.foregroundMs + 10_000,
      movementMs: 60_000,
      readingMs: 0,
      phoneMs: 0,
    })
    secondUninstall()
  })

  it('counts global foreground only while visible and forces a checkpoint on hidden/pagehide', async () => {
    const analytics = await loadAnalytics()
    const uninstall = analytics.installDwellTracking()
    vi.advanceTimersByTime(5_000)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(30_000)
    window.dispatchEvent(new Event('pagehide'))
    const hidden = analytics.getSessionActivitySnapshot()

    expect(hidden.elapsedMs).toBe(35_000)
    expect(hidden.foregroundMs).toBe(5_000)
    expect(hidden.engagedMs).toBe(5_000)
    expect(hidden.idleMs).toBe(0)
    expect(analytics.getAnalyticsIdentity().activity.lastAccountedAt).toBe(1_800_000_035_000)
    uninstall()
  })
})
