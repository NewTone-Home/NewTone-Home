import { describe, expect, it } from 'vitest'
import { progressV1Fixtures } from './fixtures/progressV1'
import {
  PROGRESS_STORAGE_KEYS,
  clearProgressStorage,
  loadProgressState,
  migrateV1ToV2,
  sanitizeV2Progress,
  serializeProgressV2,
} from '../src/stores/progressMigration'

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    has: key => values.has(key),
  }
}

describe('v1 to v2 progress migration', () => {
  it('maps a never-started user to the formal start without completion or unlock', () => {
    const migrated = migrateV1ToV2(progressV1Fixtures.neverStarted)

    expect(migrated.committedLocation).toEqual({
      phaseId: 'M1',
      pageId: 'm1-arrival',
      beatIndex: 0,
    })
    expect(migrated.readerStarted).toBe(false)
    expect(migrated.readerCompleted).toBe(false)
    expect(migrated.centerUnlocked).toBe(false)
  })

  it('maps M2 only to its default page start and preserves scroll as legacy evidence', () => {
    const migrated = migrateV1ToV2(progressV1Fixtures.midwayM2)

    expect(migrated.committedLocation).toEqual({
      phaseId: 'M2',
      pageId: 'm2-platform',
      beatIndex: 0,
    })
    expect(migrated.legacyLastScrollY).toBe(954)
    expect(migrated.readerCompleted).toBe(false)
    expect(migrated.centerUnlocked).toBe(false)
  })

  it('does not treat entering M4 as completion or Center unlock', () => {
    const migrated = migrateV1ToV2(progressV1Fixtures.enteredM4NotCompleted)

    expect(migrated.committedLocation).toEqual({
      phaseId: 'M4',
      pageId: 'm4-descent',
      beatIndex: 0,
    })
    expect(migrated.maxReadPhase).toBe('M4')
    expect(migrated.readerCompleted).toBe(false)
    expect(migrated.centerUnlocked).toBe(false)
  })

  it('permanently preserves an existing Center unlock without inventing completion', () => {
    const migrated = migrateV1ToV2(progressV1Fixtures.centerPermanentlyUnlocked)

    expect(migrated.centerUnlocked).toBe(true)
    expect(migrated.readerCompleted).toBe(false)
    expect(migrated.currentView).toBe('center')
  })

  it('is idempotent after the migrated value becomes v2', () => {
    const migrated = migrateV1ToV2(progressV1Fixtures.midwayM2)

    expect(sanitizeV2Progress(serializeProgressV2(migrated))).toEqual(migrated)
  })
})

describe('v2 sanitize and storage boundaries', () => {
  it('repairs invalid positions and prevents furthest progress from trailing committed progress', () => {
    const sanitized = sanitizeV2Progress({
      committedLocation: { phaseId: 'M3', pageId: 'm3-corridor', beatIndex: 2 },
      furthestLocation: { phaseId: 'M1', pageId: 'm1-arrival', beatIndex: 0 },
      readerStarted: true,
    })

    expect(sanitized.furthestLocation).toEqual(sanitized.committedLocation)

    const invalid = sanitizeV2Progress({
      committedLocation: { phaseId: 'M9', pageId: 'missing', beatIndex: -1 },
      furthestLocation: null,
    })
    expect(invalid.committedLocation).toEqual({
      phaseId: 'M1',
      pageId: 'm1-arrival',
      beatIndex: 0,
    })
  })

  it('sanitizes invalid v1 values without using DOM or scroll position as an exact location', () => {
    const migrated = migrateV1ToV2({
      _version: 1,
      currentView: 'center',
      lastReadPhase: 'M9',
      maxReadPhase: 'M9',
      lastScrollY: Number.NaN,
      centerUnlocked: false,
    })

    expect(migrated.currentView).toBe('landing')
    expect(migrated.committedLocation.phaseId).toBe('M1')
    expect(migrated.legacyLastScrollY).toBe(0)
  })

  it('writes v2 only after migration while retaining the original v1 payload', () => {
    const rawV1 = JSON.stringify(progressV1Fixtures.enteredM4NotCompleted)
    const storage = createMemoryStorage({ [PROGRESS_STORAGE_KEYS.V1]: rawV1 })
    const loaded = loadProgressState(storage)

    expect(loaded.centerUnlocked).toBe(false)
    expect(storage.getItem(PROGRESS_STORAGE_KEYS.V1)).toBe(rawV1)
    expect(JSON.parse(storage.getItem(PROGRESS_STORAGE_KEYS.V2))._version).toBe(2)
  })

  it('prefers an existing v2 value and repeated loads do not drift', () => {
    const migrated = migrateV1ToV2(progressV1Fixtures.midwayM2)
    const storage = createMemoryStorage({
      [PROGRESS_STORAGE_KEYS.V1]: JSON.stringify(progressV1Fixtures.neverStarted),
      [PROGRESS_STORAGE_KEYS.V2]: JSON.stringify(serializeProgressV2(migrated)),
    })

    expect(loadProgressState(storage)).toEqual(migrated)
    expect(loadProgressState(storage)).toEqual(migrated)
  })

  it('reset storage cleanup removes v1, v2, and the Reader tutorial key', () => {
    const storage = createMemoryStorage({
      [PROGRESS_STORAGE_KEYS.V1]: '{}',
      [PROGRESS_STORAGE_KEYS.V2]: '{}',
      [PROGRESS_STORAGE_KEYS.EXIT_TUTORIAL]: 'true',
    })

    clearProgressStorage(storage)

    expect(storage.has(PROGRESS_STORAGE_KEYS.V1)).toBe(false)
    expect(storage.has(PROGRESS_STORAGE_KEYS.V2)).toBe(false)
    expect(storage.has(PROGRESS_STORAGE_KEYS.EXIT_TUTORIAL)).toBe(false)
  })
})
