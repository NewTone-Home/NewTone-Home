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
  it('clears the old player state once while preserving analytics state', () => {
    const storage = memoryStorage({
      'newtone-progress-v4': '{"currentView":"reader"}',
      'newtone-narrative-progress-v2': '{}',
      'newtone-player-save-v1': '{"phoneDevice":"inner"}',
      'newtone:center:scene-layout:jijia-ancestral-home:v3': '{}',
      'newtone-analytics-visitor-v1': 'visitor-1',
      'newtone-analytics-pending-v1': '[]',
    })

    expect(applyPublicReleaseCutover(storage)).toEqual({ status: 'applied' })
    expect(storage.getItem('newtone-progress-v4')).toBeNull()
    expect(storage.getItem('newtone-narrative-progress-v2')).toBeNull()
    expect(storage.getItem('newtone-player-save-v1')).toBeNull()
    expect(storage.getItem('newtone:center:scene-layout:jijia-ancestral-home:v3')).toBeNull()
    expect(storage.getItem('newtone-analytics-visitor-v1')).toBe('visitor-1')
    expect(storage.getItem('newtone-analytics-pending-v1')).toBe('[]')
    expect(storage.getItem(PUBLIC_RELEASE_CUTOVER_STORAGE_KEY)).toBe(PUBLIC_RELEASE_CUTOVER_ID)
  })

  it('does not clear state again after the cutover marker exists', () => {
    const storage = memoryStorage({ [PUBLIC_RELEASE_CUTOVER_STORAGE_KEY]: PUBLIC_RELEASE_CUTOVER_ID })
    storage.setItem('newtone-player-save-v1', '{"currentSceneId":"jijia-ancestral-home"}')

    expect(applyPublicReleaseCutover(storage)).toEqual({ status: 'already-applied' })
    expect(storage.getItem('newtone-player-save-v1')).not.toBeNull()
  })
})
