import { describe, expect, it } from 'vitest'
import {
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
