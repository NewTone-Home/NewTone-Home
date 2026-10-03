import { beforeEach, describe, expect, it, vi } from 'vitest'

const { insert, from } = vi.hoisted(() => {
  const insert = vi.fn()
  return { insert, from: vi.fn(() => ({ insert })) }
})

vi.mock('../src/lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from },
}))

import {
  ANALYTICS_STORAGE_KEYS,
  compactPendingEvents,
  installDwellTracking,
  registerAnalyticsLifecycleObserver,
  trackEvent,
} from '../src/services/analytics.js'

function createStorage(initial = []) {
  const values = new Map([[ANALYTICS_STORAGE_KEYS.pending, JSON.stringify(initial)]])
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

function analyticsDependencies() {
  return {
    visitorId: '00000000-0000-4000-8000-000000000010',
    session: { id: '00000000-0000-4000-8000-000000000011', sequence: 0, milestones: [] },
    sessionStorage: createStorage(),
  }
}

describe('analytics trajectory queue', () => {
  beforeEach(() => insert.mockReset())

  it('keeps nineteen deferred samples queued without a timer and flushes the twentieth', async () => {
    vi.useFakeTimers()
    const storage = createStorage()
    const dependencies = analyticsDependencies()
    insert.mockResolvedValue({ error: null })

    for (let index = 0; index < 19; index += 1) {
      await trackEvent('center_position_sample', {
        sceneId: 'office', positionX: index, positionY: index,
      }, { deferred: true, storage, dependencies })
    }
    expect(insert).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)

    await trackEvent('center_position_sample', {
      sceneId: 'office', positionX: 20, positionY: 20,
    }, { deferred: true, storage, dependencies })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0]).toHaveLength(20)
    vi.useRealTimers()
  })

  it('flushes semantic events immediately', async () => {
    const storage = createStorage()
    insert.mockResolvedValueOnce({ error: null })
    await trackEvent('center_interaction_requested', {
      sceneId: 'office', objectId: 'office-plant', objectKind: 'fixture',
    }, { storage, dependencies: analyticsDependencies() })

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0][0].event_name).toBe('center_interaction_requested')
  })

  it('retains pending events after an offline send failure', async () => {
    const storage = createStorage()
    insert.mockResolvedValueOnce({ error: { code: 'NETWORK_ERROR' } })
    const result = await trackEvent('center_interaction_requested', {
      sceneId: 'office', objectId: 'office-plant', objectKind: 'fixture',
    }, { storage, dependencies: analyticsDependencies() })

    expect(result).toBe(false)
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toHaveLength(1)
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))[0].event_name).toBe('center_interaction_requested')
  })

  it('uses one lifecycle installer for hidden, pagehide, and online flush signals', async () => {
    const originalDocument = globalThis.document
    const originalWindow = globalThis.window
    const originalLocalStorage = globalThis.localStorage
    const originalSessionStorage = globalThis.sessionStorage
    const originalFetch = globalThis.fetch
    const documentTarget = new EventTarget()
    Object.defineProperty(documentTarget, 'visibilityState', { value: 'visible', writable: true })
    const windowTarget = new EventTarget()
    const storage = createStorage()
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('window', windowTarget)
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    const fetch = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetch)
    const observed = []
    const removeObserver = registerAnalyticsLifecycleObserver({
      onVisibilityChange: visible => observed.push(`visibility:${visible}`),
      onPagehide: () => observed.push('pagehide'),
      onOnline: () => observed.push('online'),
    })
    const removeInstaller = installDwellTracking()

    await trackEvent('center_position_sample', {
      sceneId: 'office', positionX: 30, positionY: 40,
    }, { deferred: true, storage, dependencies: analyticsDependencies() })
    Object.defineProperty(documentTarget, 'visibilityState', { value: 'hidden', writable: true })
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    windowTarget.dispatchEvent(new Event('pagehide'))
    windowTarget.dispatchEvent(new Event('online'))
    await Promise.resolve()

    expect(observed).toEqual(['visibility:false', 'pagehide', 'online'])
    expect(fetch).toHaveBeenCalled()
    expect(fetch.mock.calls.some(call => call[1]?.keepalive === true)).toBe(true)
    removeInstaller()
    removeObserver()
    vi.unstubAllGlobals()
    if (originalDocument !== undefined) vi.stubGlobal('document', originalDocument)
    if (originalWindow !== undefined) vi.stubGlobal('window', originalWindow)
    if (originalLocalStorage !== undefined) vi.stubGlobal('localStorage', originalLocalStorage)
    if (originalSessionStorage !== undefined) vi.stubGlobal('sessionStorage', originalSessionStorage)
    if (originalFetch !== undefined) vi.stubGlobal('fetch', originalFetch)
  })

  it('drops old position samples before checkpoints and preserves interaction events on overflow', () => {
    const pending = Array.from({ length: 3200 }, (_, index) => ({
      client_event_id: String(index),
      event_name: index < 1200 ? 'center_position_sample' : 'session_checkpoint',
    }))
    pending.push({ client_event_id: 'important', event_name: 'center_interaction_requested' })
    const compacted = compactPendingEvents(pending)

    expect(compacted).toHaveLength(2000)
    expect(compacted.some(item => item.client_event_id === 'important')).toBe(true)
    expect(compacted.some(item => item.event_name === 'center_position_sample')).toBe(false)
  })

  it('drops position samples before checkpoints, then old checkpoints, but never semantic facts', () => {
    const positionOverflow = Array.from({ length: 2000 }, (_, index) => ({
      client_event_id: `position-${index}`,
      event_name: index === 0 ? 'center_position_sample' : 'session_checkpoint',
    }))
    positionOverflow.push({ client_event_id: 'important', event_name: 'center_interaction_completed' })
    const afterPosition = compactPendingEvents(positionOverflow)
    expect(afterPosition.some(item => item.client_event_id === 'position-0')).toBe(false)
    expect(afterPosition.some(item => item.event_name === 'session_checkpoint')).toBe(true)
    expect(afterPosition.some(item => item.client_event_id === 'important')).toBe(true)

    const checkpointOverflow = Array.from({ length: 2001 }, (_, index) => ({
      client_event_id: `checkpoint-${index}`,
      event_name: 'session_checkpoint',
    }))
    checkpointOverflow.push({ client_event_id: 'important', event_name: 'center_interaction_requested' })
    const afterCheckpoint = compactPendingEvents(checkpointOverflow)
    expect(afterCheckpoint.some(item => item.client_event_id === 'checkpoint-0')).toBe(false)
    expect(afterCheckpoint.some(item => item.event_name === 'session_checkpoint')).toBe(true)
    expect(afterCheckpoint.some(item => item.client_event_id === 'important')).toBe(true)

    const importantOnly = Array.from({ length: 2001 }, (_, index) => ({
      client_event_id: `semantic-${index}`,
      event_name: 'center_interaction_requested',
    }))
    expect(compactPendingEvents(importantOnly)).toHaveLength(2001)
  })
})
