import { describe, expect, it } from 'vitest'
import {
  PROGRESS_STORAGE_KEYS,
  createInitialProgressState,
  loadProgressState,
  saveProgressState,
} from './progressMigration'

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    dump: () => Object.fromEntries(values),
  }
}

describe('progress migration V3', () => {
  it('migrates a V2 save without forgetting onboarding or Reader progress', () => {
    const storage = memoryStorage({
      [PROGRESS_STORAGE_KEYS.V2]: JSON.stringify({
        _version: 2,
        ...createInitialProgressState(),
        hasInitializedLanguage: true,
        hasInitializedReadingMode: true,
        readerStarted: true,
        committedLocation: { phaseId: 'M1', pageId: 'inner-street', beatIndex: 2 },
        furthestLocation: { phaseId: 'M1', pageId: 'commercial-street', beatIndex: 4 },
      }),
    })

    const loaded = loadProgressState(storage)
    expect(loaded.hasInitializedLanguage).toBe(true)
    expect(loaded.hasInitializedReadingMode).toBe(true)
    expect(loaded.committedLocation.pageId).toBe('inner-street')
    expect(loaded.furthestLocation.pageId).toBe('commercial-street')
    expect(loaded.centerViewSnapshot.camera).toBeNull()
    expect(storage.dump()[PROGRESS_STORAGE_KEYS.V3]).toBeTruthy()
  })

  it('persists Center world and camera snapshots while ignoring transient runtime fields', () => {
    const storage = memoryStorage()
    saveProgressState(storage, {
      ...createInitialProgressState(),
      centerWorldSnapshot: {
        definitionId: 'world',
        progressKey: 'opening',
        surfaceVariant: 'surface',
        innerVariant: 'inner',
        unlockedLandmarkIds: ['a'],
        visitedLandmarkIds: ['a'],
        contextualLandmarkIds: ['a'],
      },
      centerViewSnapshot: {
        camera: { scrollX: 120, scrollY: 40, zoom: 1.5 },
        expansion: 0.6,
        activeLayer: 'inner',
        selectedLandmarkId: 'a',
        hoveredLandmarkId: 'transient',
      },
      projections: { a: { x: 10, y: 20 } },
    })

    const raw = JSON.parse(storage.dump()[PROGRESS_STORAGE_KEYS.V3])
    expect(raw.centerViewSnapshot.camera).toEqual({ scrollX: 120, scrollY: 40, zoom: 1.5 })
    expect(raw.centerViewSnapshot.hoveredLandmarkId).toBeUndefined()
    expect(raw.projections).toBeUndefined()
  })
})
