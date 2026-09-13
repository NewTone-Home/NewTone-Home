import { describe, expect, it, vi } from 'vitest'

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

describe('analytics pending queue', () => {
  it('removes events after a successful send', async () => {
    const storage = createStorage([event])
    insert.mockResolvedValueOnce({ error: null })

    await expect(flushAnalyticsQueue({ storage })).resolves.toBe(true)
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([])
    expect(insert).toHaveBeenCalledWith([event])
  })

  it('keeps events when the send fails', async () => {
    const storage = createStorage([event])
    insert.mockResolvedValueOnce({ error: { code: '42501' } })

    await expect(flushAnalyticsQueue({ storage })).resolves.toBe(false)
    expect(JSON.parse(storage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([event])
  })
})
