import { describe, expect, it } from 'vitest'
import {
  attachPositionSaveLifecycle,
  createPositionSaveCoordinator,
  PLAYER_SAVE_STORAGE_KEY,
  clearPlayerSave,
  createInitialPlayerSave,
  hasResumablePlayerSave,
  loadPlayerSave,
  recordPlayerScenePosition,
  recordPlayerSceneState,
  savePlayerSave,
} from '../src/center/runtime/playerSave'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { PUBLIC_RELEASE_CUTOVER_ID, PUBLIC_RELEASE_CUTOVER_STORAGE_KEY } from '../src/services/publicReleaseMigration'

function createStorage() {
  const values = new Map([[PUBLIC_RELEASE_CUTOVER_STORAGE_KEY, PUBLIC_RELEASE_CUTOVER_ID]])
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

describe('player local save contract', () => {
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
    let writes = 0
    const coordinator = createPositionSaveCoordinator({
      getSave: () => save,
      setSave: next => { save = next },
      getCurrentSceneId: () => save.currentSceneId,
      recordPosition: recordPlayerScenePosition,
      persist: next => { writes += 1; return savePlayerSave(next, storage, writes) },
    })
    coordinator.queue('commercial-street', { x: 88, y: 31 })
    coordinator.commit(current => recordPlayerSceneState(current, 'commercial-street', 'orderStatus', 'ready'))
    expect(writes).toBe(1)
    expect(loadPlayerSave(storage)).toMatchObject({
      currentPosition: { x: 88, y: 31 },
      scenePositions: { 'commercial-street': { x: 88, y: 31 } },
      sceneState: { 'commercial-street': { orderStatus: 'ready' } },
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
    expect(loadPlayerSave(storage)).toMatchObject({
      currentSceneId: 'commercial-cafe',
      currentPosition: { x: 12, y: 18 },
      scenePositions: { 'commercial-street': { x: 91, y: 32 } },
    })
    const writesAfterTransition = writes
    coordinator.flush('commercial-street') // outgoing scene effect cleanup
    expect(writes).toBe(writesAfterTransition)
    expect(loadPlayerSave(storage).currentSceneId).toBe('commercial-cafe')
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
    const cleanup = attachPositionSaveLifecycle(
      sceneId => coordinator.flush(sceneId),
      () => save.currentSceneId,
      windowTarget,
      documentTarget,
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
      phoneDevice: 'surface',
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
