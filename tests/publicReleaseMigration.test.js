import { describe, expect, it } from 'vitest'
import {
  applyPublicReleaseCutover,
  PUBLIC_RELEASE_CUTOVER_ID,
  PUBLIC_RELEASE_CUTOVER_STORAGE_KEY,
} from '../src/services/publicReleaseMigration'

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    get length() { return data.size },
    key(index) { return [...data.keys()][index] ?? null },
    getItem(key) { return data.has(key) ? data.get(key) : null },
    setItem(key, value) { data.set(key, String(value)) },
    removeItem(key) { data.delete(key) },
  }
}

describe('public release cutover', () => {
  it('does not cut over or delete original game, Reader, layout or analytics state', () => {
    const storage = memoryStorage({
      'newtone-progress-v4': '{"currentView":"reader"}',
      'newtone-narrative-progress-v2': '{}',
      'newtone-player-save-v1': '{"phoneDevice":"inner"}',
      'newtone:center:scene-layout:jijia-ancestral-home:v3': '{}',
      'newtone-analytics-visitor-v1': 'visitor-1',
      'newtone-analytics-pending-v1': '[]',
    })

    const before = Object.fromEntries(Array.from({ length: storage.length }, (_, i) => [storage.key(i), storage.getItem(storage.key(i))]))
    expect(applyPublicReleaseCutover(storage)).toEqual({ status: 'save-entry-service-owns-migration' })
    expect(storage.getItem('newtone-progress-v4')).toBe(before['newtone-progress-v4'])
    expect(storage.getItem('newtone-narrative-progress-v2')).toBe(before['newtone-narrative-progress-v2'])
    expect(storage.getItem('newtone-player-save-v1')).toBe(before['newtone-player-save-v1'])
    expect(storage.getItem('newtone:center:scene-layout:jijia-ancestral-home:v3')).toBe(before['newtone:center:scene-layout:jijia-ancestral-home:v3'])
    expect(storage.getItem('newtone-analytics-visitor-v1')).toBe('visitor-1')
    expect(storage.getItem('newtone-analytics-pending-v1')).toBe('[]')
    expect(storage.getItem(PUBLIC_RELEASE_CUTOVER_STORAGE_KEY)).toBeNull()
    expect(Object.fromEntries(Array.from({ length: storage.length }, (_, i) => [storage.key(i), storage.getItem(storage.key(i))]))).toEqual(before)
    expect(applyPublicReleaseCutover(storage)).toEqual({ status: 'save-entry-service-owns-migration' })
    expect(Object.fromEntries(Array.from({ length: storage.length }, (_, i) => [storage.key(i), storage.getItem(storage.key(i))]))).toEqual(before)
  })

  it('keeps a historical cutover marker and repeated calls completely unchanged', () => {
    const storage = memoryStorage({ [PUBLIC_RELEASE_CUTOVER_STORAGE_KEY]: PUBLIC_RELEASE_CUTOVER_ID })
    storage.setItem('newtone-player-save-v1', '{"currentSceneId":"jijia-ancestral-home"}')

    const before = Object.fromEntries(Array.from({ length: storage.length }, (_, i) => [storage.key(i), storage.getItem(storage.key(i))]))
    expect(applyPublicReleaseCutover(storage)).toEqual({ status: 'save-entry-service-owns-migration' })
    expect(applyPublicReleaseCutover(storage)).toEqual({ status: 'save-entry-service-owns-migration' })
    expect(Object.fromEntries(Array.from({ length: storage.length }, (_, i) => [storage.key(i), storage.getItem(storage.key(i))]))).toEqual(before)
    expect(storage.getItem(PUBLIC_RELEASE_CUTOVER_STORAGE_KEY)).toBe(PUBLIC_RELEASE_CUTOVER_ID)
    expect(storage.getItem('newtone-player-save-v1')).not.toBeNull()
  })
})
