import { describe, expect, it } from 'vitest'
import {
  attachPositionSaveLifecycle,
  createPositionSaveCoordinator,
  createGameTimeSaveCheckpoint,
  PLAYER_SAVE_STORAGE_KEY,
  clearPlayerSave,
  createInitialPlayerSave,
  hasResumablePlayerSave,
  loadPlayerSave,
  recordPlayerScenePosition,
  recordPlayerSceneState,
  savePlayerSave,
  sanitizePlayerSave,
} from '../src/center/runtime/playerSave'
import { createGameClock } from '../src/center/runtime/gameClock'
import { mainlineScenes, legacyCafeEntryPosition } from '../src/center/runtime/mainlineScenes'
import { PUBLIC_RELEASE_CUTOVER_ID, PUBLIC_RELEASE_CUTOVER_STORAGE_KEY } from '../src/services/publicReleaseMigration'
import { defaultLaoZhouCafeSeatId, isLaoZhouCafeSeatId, selectLaoZhouCafeSeat } from '../src/center/runtime/commercialCafeSeatSelection'

function createStorage() {
  const values = new Map([[PUBLIC_RELEASE_CUTOVER_STORAGE_KEY, PUBLIC_RELEASE_CUTOVER_ID]])
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

describe('player local save contract', () => {
  it('chooses and persists a fresh Cafe seat once without changing landing or story/phone defaults', () => {
    const storage = createStorage()
    let draws = 0
    const first = loadPlayerSave(storage, undefined, () => { draws += 1; return 0.75 })
    const second = loadPlayerSave(storage, undefined, () => { draws += 1; return 0 })

    expect(first.laoZhouCafeSeatId).toBeTruthy()
    expect(isLaoZhouCafeSeatId(first.laoZhouCafeSeatId)).toBe(true)
    expect(second.laoZhouCafeSeatId).toBe(first.laoZhouCafeSeatId)
    expect(draws).toBe(1)
    expect(first.updatedAt).toBe(0)
    expect(first.gameTimeMs).toBe(createInitialPlayerSave().gameTimeMs)
    expect(hasResumablePlayerSave(storage)).toBe(false)
    expect(first.sceneState).toEqual({})
    expect(first.phoneDevice).toBe(createInitialPlayerSave().phoneDevice)

    const started = savePlayerSave(first, storage, 10)
    expect(started).not.toHaveProperty('freshSeatOnly')
    expect(hasResumablePlayerSave(storage)).toBe(true)
  })

  it('keeps legacy and pre-field saves on the original seat without changing completed-story or phone state', () => {
    const legacyStorage = createStorage()
    legacyStorage.setItem('newtone.mainline.carried-phone.v2', JSON.stringify({ device: 'inner' }))
    let draws = 0
    const migrated = loadPlayerSave(legacyStorage, undefined, () => { draws += 1; return 0.9 })
    expect(migrated.laoZhouCafeSeatId).toBe(defaultLaoZhouCafeSeatId)
    expect(migrated.phoneDevice).toBe('inner')
    expect(draws).toBe(0)

    const oldSaveStorage = createStorage()
    const oldSave = createInitialPlayerSave('commercial-street')
    delete oldSave.gameTimeMs
    oldSave.laoZhouCafeSeatId = selectLaoZhouCafeSeat(() => 0.75)
    oldSave.storyClock = { ...oldSave.storyClock, hour: 15, minute: 20 }
    const seatBeforeMigration = oldSave.laoZhouCafeSeatId
    oldSave.updatedAt = 123
    oldSave.sceneState['commercial-street'] = {
      commercialCafeStoryStatus: 'complete',
      commercialCafeNarrativeCursor: 14,
      commercialCafePhoneHandoff: 'shown',
    }
    oldSaveStorage.setItem(PLAYER_SAVE_STORAGE_KEY, JSON.stringify(oldSave))
    const restored = loadPlayerSave(oldSaveStorage, undefined, () => { draws += 1; return 0.2 })
    expect(restored.laoZhouCafeSeatId).toBe(seatBeforeMigration)
    expect(restored.sceneState['commercial-street']).toEqual(oldSave.sceneState['commercial-street'])
    expect(restored.updatedAt).toBe(123)
    expect(restored.gameTimeMs).toBe((15 * 60 + 20) * 60_000)
    expect(restored.laoZhouCafeSeatId).toBe(seatBeforeMigration)
    expect(draws).toBe(0)
    savePlayerSave(restored, oldSaveStorage, 234)
    expect(loadPlayerSave(oldSaveStorage).gameTimeMs).toBe(restored.gameTimeMs)
    expect(loadPlayerSave(oldSaveStorage).laoZhouCafeSeatId).toBe(seatBeforeMigration)
  })

  it('stabilizes invalid saved seat IDs to the old seat and preserves the other save fields', () => {
    const storage = createStorage()
    const save = { ...createInitialPlayerSave('commercial-street'), laoZhouCafeSeatId: 'broken-seat-id', updatedAt: 456 }
    storage.setItem(PLAYER_SAVE_STORAGE_KEY, JSON.stringify(save))
    const restored = loadPlayerSave(storage, undefined, () => { throw new Error('existing saves must not reroll') })
    expect(restored.laoZhouCafeSeatId).toBe(defaultLaoZhouCafeSeatId)
    expect(restored.updatedAt).toBe(456)
    expect(restored.currentSceneId).toBe('commercial-street')
  })

  it('seeds new saves and migrates old saves from their saved story-clock time', () => {
    const fresh = createInitialPlayerSave('commercial-street')
    expect(fresh.gameTimeMs).toBe((11 * 60) * 60_000)

    const oldSave = sanitizePlayerSave({
      ...fresh,
      gameTimeMs: undefined,
      storyClock: { ...fresh.storyClock, hour: 15, minute: 20 },
    }, 'commercial-street')
    expect(oldSave.gameTimeMs).toBe((15 * 60 + 20) * 60_000)
    expect(oldSave.storyClock.dayId).toBe(fresh.storyClock.dayId)
  })

  it('restores valid simulated time without adding offline wall time and falls back on invalid values', () => {
    const storage = createStorage()
    const saved = { ...createInitialPlayerSave('commercial-street'), gameTimeMs: 49_200_123 }
    savePlayerSave(saved, storage, 1000)
    const loaded = loadPlayerSave(storage)
    expect(loaded.gameTimeMs).toBe(saved.gameTimeMs)

    let realNow = 9_000_000
    const resumedClock = createGameClock({ now: () => realNow, initialGameTimeMs: loaded.gameTimeMs, multiplier: 30 })
    realNow += 1000
    expect(resumedClock.read().gameTimeMs).toBe(saved.gameTimeMs + 30_000)

    expect(sanitizePlayerSave({ ...saved, gameTimeMs: -1 }, 'commercial-street').gameTimeMs)
      .toBe((11 * 60) * 60_000)
    expect(sanitizePlayerSave({ ...saved, gameTimeMs: null }, 'commercial-street').gameTimeMs)
      .toBe((11 * 60) * 60_000)
  })

  it('checkpoints into the latest save, preserving unrelated progress and honoring clear-save', () => {
    const storage = createStorage()
    const fresh = loadPlayerSave(storage, 'commercial-street', () => 0.55)
    let save = {
      ...fresh,
      currentPosition: { x: 72, y: 38 },
      scenePositions: { 'commercial-street': { x: 72, y: 38 } },
      sceneState: {
        'commercial-street': { commercialStreetMilkTeaHeldDrink: 'milk-tea', orderStatus: 'held' },
        'commercial-cafe': { commercialCafeStoryStatus: 'complete', commercialCafeNarrativeCursor: 14 },
      },
      phoneDevice: 'surface',
    }
    let sampled = 55_000_000
    let persisted = null
    let writes = 0
    const checkpoint = createGameTimeSaveCheckpoint({
      getSave: () => save,
      setSave: next => { save = next },
      getGameTimeMs: () => sampled,
      persist: next => { writes += 1; persisted = savePlayerSave(next, storage, writes); return persisted },
    })
    checkpoint()
    expect(save).toMatchObject({
      gameTimeMs: sampled,
      currentPosition: { x: 72, y: 38 },
      scenePositions: { 'commercial-street': { x: 72, y: 38 } },
      phoneDevice: 'surface',
      sceneState: {
        'commercial-street': { commercialStreetMilkTeaHeldDrink: 'milk-tea', orderStatus: 'held' },
        'commercial-cafe': { commercialCafeStoryStatus: 'complete', commercialCafeNarrativeCursor: 14 },
      },
      laoZhouCafeSeatId: fresh.laoZhouCafeSeatId,
    })

    expect(loadPlayerSave(storage)).toMatchObject({
      gameTimeMs: sampled,
      phoneDevice: 'surface',
      currentPosition: { x: 72, y: 38 },
      sceneState: save.sceneState,
      laoZhouCafeSeatId: fresh.laoZhouCafeSeatId,
    })
    clearPlayerSave(storage)
    const writesBeforeOldCallback = writes
    sampled += 30_000
    checkpoint()
    expect(writes).toBe(writesBeforeOldCallback)
    expect(storage.getItem(PLAYER_SAVE_STORAGE_KEY)).toBeNull()
  })

  it('keeps freshSeatOnly during a time-only checkpoint until gameplay progress is saved', () => {
    const storage = createStorage()
    let save = loadPlayerSave(storage, undefined, () => 0.42)
    const seat = save.laoZhouCafeSeatId
    const checkpoint = createGameTimeSaveCheckpoint({
      getSave: () => save,
      setSave: next => { save = next },
      getGameTimeMs: () => save.gameTimeMs + 30_000,
      persist: next => savePlayerSave(next, storage, Date.now(), { preserveFreshSeatOnly: true }),
    })

    checkpoint()
    expect(save).toMatchObject({ freshSeatOnly: true, updatedAt: 0, laoZhouCafeSeatId: seat })
    expect(loadPlayerSave(storage)).toMatchObject({ freshSeatOnly: true, gameTimeMs: save.gameTimeMs, laoZhouCafeSeatId: seat })
    expect(hasResumablePlayerSave(storage)).toBe(false)

    const started = savePlayerSave({ ...save, currentPosition: { x: 12, y: 18 } }, storage, 123)
    expect(started).not.toHaveProperty('freshSeatOnly')
    expect(hasResumablePlayerSave(storage)).toBe(true)
  })

  it('keeps the in-memory game time when checkpoint storage is unavailable', () => {
    const unavailable = {
      getItem: () => null,
      setItem: () => { throw new Error('storage denied') },
      removeItem: () => { throw new Error('storage denied') },
    }
    let save = createInitialPlayerSave('commercial-street')
    const checkpoint = createGameTimeSaveCheckpoint({
      getSave: () => save,
      setSave: next => { save = next },
      getGameTimeMs: () => 48_000_000,
      persist: next => savePlayerSave(next, unavailable, 200),
    })
    expect(() => checkpoint()).not.toThrow()
    expect(save.gameTimeMs).toBe(48_000_000)
    expect(() => loadPlayerSave(unavailable)).not.toThrow()
  })

  it('keeps the version-one phone migration while adding the clock fallback', () => {
    const migrated = sanitizePlayerSave({
      ...createInitialPlayerSave('commercial-street'),
      _version: 1,
      phoneDevice: 'surface',
      gameTimeMs: undefined,
    }, 'commercial-street')
    expect(migrated.phoneDevice).toBe('inner')
    expect(migrated.gameTimeMs).toBe((11 * 60) * 60_000)
  })

  it('coalesces RAF samples and persists the latest position on stop', () => {
    const storage = createStorage()
    let save = createInitialPlayerSave('commercial-street')
    let writes = 0
    const coordinator = createPositionSaveCoordinator({
      getSave: () => save,
      setSave: next => { save = next },
      getCurrentSceneId: () => save.currentSceneId,
      recordPosition: recordPlayerScenePosition,
      persist: next => { writes += 1; return savePlayerSave(next, storage, writes) },
    })
    for (let frame = 0; frame < 120; frame += 1) coordinator.queue('commercial-street', { x: frame, y: 24 })
    expect(writes).toBe(0)
    coordinator.flush('commercial-street') // movement stopped
    expect(writes).toBe(1)
    expect(loadPlayerSave(storage).currentPosition).toEqual({ x: 119, y: 24 })
  })

  it('merges the latest position into a critical story commit without losing story state', () => {
    const storage = createStorage()
    let save = createInitialPlayerSave('commercial-street')
    const gameTimeMs = (13 * 60 + 45) * 60_000
    let writes = 0
    const coordinator = createPositionSaveCoordinator({
      getSave: () => save,
      setSave: next => { save = next },
      getCurrentSceneId: () => save.currentSceneId,
      recordPosition: recordPlayerScenePosition,
      persist: next => { writes += 1; return savePlayerSave({ ...next, gameTimeMs }, storage, writes) },
    })
    coordinator.queue('commercial-street', { x: 88, y: 31 })
    coordinator.commit(current => recordPlayerSceneState(current, 'commercial-street', 'orderStatus', 'ready'))
    expect(writes).toBe(1)
    expect(loadPlayerSave(storage)).toMatchObject({
      currentPosition: { x: 88, y: 31 },
      scenePositions: { 'commercial-street': { x: 88, y: 31 } },
      sceneState: { 'commercial-street': { orderStatus: 'ready' } },
      gameTimeMs,
    })
  })

  it('flushes on scene change before switching and makes later old-scene cleanup harmless', () => {
    const storage = createStorage()
    let save = createInitialPlayerSave('commercial-street')
    let writes = 0
    const coordinator = createPositionSaveCoordinator({
      getSave: () => save,
      setSave: next => { save = next },
      getCurrentSceneId: () => save.currentSceneId,
      recordPosition: recordPlayerScenePosition,
      persist: next => { writes += 1; return savePlayerSave(next, storage, writes) },
    })
    coordinator.queue('commercial-street', { x: 91, y: 32 })
    coordinator.commit(current => ({ ...current, currentSceneId: 'commercial-cafe', currentPosition: { x: 12, y: 18 } }))
    const arrived = legacyCafeEntryPosition({ x: 12, y: 18 })
    expect(loadPlayerSave(storage)).toMatchObject({
      currentSceneId: 'commercial-street',
      currentPosition: arrived,
      scenePositions: { 'commercial-street': arrived },
    })
    const writesAfterTransition = writes
    coordinator.flush('commercial-street') // outgoing scene effect cleanup
    expect(writes).toBe(writesAfterTransition)
    expect(loadPlayerSave(storage)).toMatchObject({ currentSceneId: 'commercial-street', currentPosition: arrived })
  })

  it('flushes the last queued sample from hidden and pagehide lifecycle callbacks', () => {
    const storage = createStorage()
    let save = createInitialPlayerSave('commercial-street')
    let writes = 0
    const coordinator = createPositionSaveCoordinator({
      getSave: () => save,
      setSave: next => { save = next },
      getCurrentSceneId: () => save.currentSceneId,
      recordPosition: recordPlayerScenePosition,
      persist: next => { writes += 1; return savePlayerSave(next, storage, writes) },
    })
    const listeners = new Map()
    const windowTarget = {
      addEventListener: (event, callback) => listeners.set(`window:${event}`, callback),
      removeEventListener: event => listeners.delete(`window:${event}`),
    }
    let visibilityState = 'visible'
    const documentTarget = {
      get visibilityState() { return visibilityState },
      addEventListener: (event, callback) => listeners.set(`document:${event}`, callback),
      removeEventListener: event => listeners.delete(`document:${event}`),
    }
    let checkpoints = 0
    const cleanup = attachPositionSaveLifecycle(
      sceneId => coordinator.flush(sceneId),
      () => save.currentSceneId,
      windowTarget,
      documentTarget,
      () => { checkpoints += 1 },
    )
    coordinator.queue('commercial-street', { x: 44, y: 20 })
    visibilityState = 'hidden'
    listeners.get('document:visibilitychange')()
    expect(loadPlayerSave(storage).currentPosition).toEqual({ x: 44, y: 20 })
    coordinator.queue('commercial-street', { x: 45, y: 20 })
    listeners.get('window:pagehide')()
    expect(loadPlayerSave(storage).currentPosition).toEqual({ x: 45, y: 20 })
    coordinator.queue('commercial-street', { x: 46, y: 20 })
    cleanup()
    expect(loadPlayerSave(storage).currentPosition).toEqual({ x: 46, y: 20 })
    expect(writes).toBe(3)
    expect(checkpoints).toBe(3)
    expect(listeners.size).toBe(0)
  })
  it('returns the same save for an unchanged persisted position', () => {
    const initial = createInitialPlayerSave('jijia-ancestral-home')
    const next = recordPlayerScenePosition(initial, 'jijia-ancestral-home', { x: 12, y: 24 })
    expect(recordPlayerScenePosition(next, 'jijia-ancestral-home', { x: 12, y: 24 })).toBe(next)
    expect(recordPlayerScenePosition(next, 'jijia-ancestral-home', { x: 13, y: 24 })).not.toBe(next)
  })
  it('distinguishes a fresh default save from a resumable session', () => {
    const storage = createStorage()
    expect(hasResumablePlayerSave(storage)).toBe(false)

    const initial = createInitialPlayerSave('jijia-ancestral-home')
    const position = mainlineScenes['jijia-ancestral-home'].initialPlayerPosition
    savePlayerSave(recordPlayerScenePosition(initial, 'jijia-ancestral-home', position), storage, 1000)
    expect(hasResumablePlayerSave(storage)).toBe(true)
  })

  it('stores only the player save under its own local key', () => {
    const storage = createStorage()
    const initial = createInitialPlayerSave('jijia-ancestral-home')
    const next = recordPlayerScenePosition(initial, 'jijia-ancestral-home', { x: 12, y: 24 })
    savePlayerSave(next, storage, 1000)

    expect(storage.getItem(PLAYER_SAVE_STORAGE_KEY)).toContain('jijia-ancestral-home')
    expect(loadPlayerSave(storage)).toMatchObject({
      currentSceneId: 'jijia-ancestral-home',
      currentPosition: { x: 12, y: 24 },
      updatedAt: 1000,
    })
  })

  it('keeps only persistent scene state together', () => {
    const initial = createInitialPlayerSave('jijia-ancestral-home')
    const next = recordPlayerSceneState(initial, 'zhongshuyuan-office', 'blindsOpen', false)

    expect(next.sceneState['zhongshuyuan-office']).toEqual({ blindsOpen: false })
    expect(next).not.toHaveProperty('completedInteractions')
    expect(next).not.toHaveProperty('choices')
  })

  it('sanitizes malformed or unknown values instead of crashing the player session', () => {
    const storage = createStorage()
    storage.setItem(PLAYER_SAVE_STORAGE_KEY, JSON.stringify({
      currentSceneId: 'jijia-ancestral-home',
      currentPosition: { x: 'bad', y: 4 },
      phoneDevice: 'unknown',
      completedInteractions: { home: ['tree', 4, 'tree'] },
      choices: { ok: true, bad: { nested: true } },
    }))

    expect(loadPlayerSave(storage)).toMatchObject({
      currentPosition: null,
      currentSceneId: 'commercial-street',
      phoneDevice: 'inner',
    })
  })

  it('clears only the player save key', () => {
    const storage = createStorage()
    storage.setItem(PLAYER_SAVE_STORAGE_KEY, '{}')
    storage.setItem('newtone-progress-v4', '{}')
    clearPlayerSave(storage)

    expect(storage.getItem(PLAYER_SAVE_STORAGE_KEY)).toBeNull()
    expect(storage.getItem('newtone-progress-v4')).toBe('{}')
  })
})
