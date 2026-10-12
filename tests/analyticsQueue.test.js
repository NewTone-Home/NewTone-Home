import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { insert, from } = vi.hoisted(() => {
  const insert = vi.fn()
  return { insert, from: vi.fn(() => ({ insert })) }
})

vi.mock('../src/lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from },
}))

import { ANALYTICS_STORAGE_KEYS, flushAnalyticsQueue } from '../src/services/analytics.js'

function createStorage(initial = []) {
  const values = new Map([[ANALYTICS_STORAGE_KEYS.pending, JSON.stringify(initial)]])
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

const event = {
  client_event_id: '00000000-0000-0000-0000-000000000001',
  visitor_id: '00000000-0000-0000-0000-000000000002',
  session_id: '00000000-0000-0000-0000-000000000003',
  sequence: 1,
  event_name: 'center_entry_requested',
}
const legacyEvent = { ...event, occurred_at: '2026-10-12T10:00:00.000Z' }
const legacyEventForInsert = {
  ...legacyEvent,
  device_category: 'unknown',
  viewport_width: null,
  viewport_height: null,
}
const eventForInsert = {
  ...event,
  device_category: 'unknown',
  viewport_width: null,
  viewport_height: null,
}

describe('analytics pending queue', () => {
  beforeEach(() => insert.mockReset())
  afterEach(() => vi.unstubAllGlobals())

  it('removes events after a successful send', async () => {
    const storage = createStorage([event])
    insert.mockResolvedValueOnce({ error: null })

    await expect(flushAnalyticsQueue({ storage })).resolves.toBe(true)
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([])
    expect(insert).toHaveBeenCalledWith([eventForInsert])
  })

  it('keeps events when the send fails', async () => {
    const storage = createStorage([event])
    insert.mockResolvedValueOnce({ error: { code: '42501' } })

    await expect(flushAnalyticsQueue({ storage })).resolves.toBe(false)
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([event])
  })

  it('fills legacy metadata on send without changing event identity, time, or the stored snapshot', async () => {
    const storage = createStorage([legacyEvent])
    insert.mockResolvedValueOnce({ error: { code: '42501' } })
    insert.mockResolvedValueOnce({ error: null })

    await expect(flushAnalyticsQueue({ storage })).resolves.toBe(false)
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([legacyEvent])

    await expect(flushAnalyticsQueue({ storage })).resolves.toBe(true)
    expect(insert).toHaveBeenNthCalledWith(1, [legacyEventForInsert])
    expect(insert).toHaveBeenNthCalledWith(2, [legacyEventForInsert])
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([])
  })

  it('normalizes old events in a mixed batch and preserves new viewport snapshots', async () => {
    const currentEvent = {
      ...event,
      client_event_id: '00000000-0000-0000-0000-000000000004',
      occurred_at: '2026-10-12T10:01:00.000Z',
      device_category: 'tablet',
      viewport_width: 820,
      viewport_height: 1180,
    }
    const storage = createStorage([legacyEvent, currentEvent])
    insert.mockResolvedValueOnce({ error: null })

    await expect(flushAnalyticsQueue({ storage })).resolves.toBe(true)
    expect(insert).toHaveBeenCalledWith([legacyEventForInsert, currentEvent])
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([])
  })

  it('keeps keepalive inserts out of the ON CONFLICT path that requires SELECT privilege', async () => {
    const storage = createStorage([legacyEvent])
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await expect(flushAnalyticsQueue({ keepalive: true, storage })).resolves.toBe(true)
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).not.toContain('on_conflict')
    expect(request.headers.Prefer).toBe('return=minimal')
    expect(request.body).toBe(JSON.stringify([legacyEventForInsert]))
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([])
  })

  it('keeps a duplicate keepalive batch queued for the normal duplicate-safe retry path', async () => {
    const storage = createStorage([legacyEvent])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(flushAnalyticsQueue({ keepalive: true, storage })).resolves.toBe(false)
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([legacyEvent])

    insert.mockResolvedValueOnce({ error: { code: '23505' } })
    insert.mockResolvedValueOnce({ error: { code: '23505' } })
    await expect(flushAnalyticsQueue({ storage })).resolves.toBe(true)
    expect(insert).toHaveBeenNthCalledWith(1, [legacyEventForInsert])
    expect(insert).toHaveBeenNthCalledWith(2, legacyEventForInsert)
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([])
  })
})
