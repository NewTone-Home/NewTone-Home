import { describe, expect, it } from 'vitest'
import {
  advanceCommercialCafeStoryStage,
  commercialCafeStoryStageFromSceneState,
  commercialCafeStoryStageKey,
  initialCommercialCafeStoryStage,
} from '../src/center/runtime/commercialCafeStory'
import {
  createInitialPlayerSave,
  loadPlayerSave,
  recordPlayerSceneState,
  savePlayerSave,
} from '../src/center/runtime/playerSave'
import { PUBLIC_RELEASE_CUTOVER_ID, PUBLIC_RELEASE_CUTOVER_STORAGE_KEY } from '../src/services/publicReleaseMigration'

function createStorage() {
  const values = new Map([[PUBLIC_RELEASE_CUTOVER_STORAGE_KEY, PUBLIC_RELEASE_CUTOVER_ID]])
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('commercial cafe story stage', () => {
  it('starts at entered when the cafe has no saved stage', () => {
    expect(commercialCafeStoryStageFromSceneState(undefined)).toBe(initialCommercialCafeStoryStage)
    expect(commercialCafeStoryStageFromSceneState({ [commercialCafeStoryStageKey]: 'unexpected' })).toBe('entered')
  })

  it('advances through the authored cafe sequence without moving past complete', () => {
    expect(advanceCommercialCafeStoryStage('entered')).toBe('coffee-ordered')
    expect(advanceCommercialCafeStoryStage('coffee-ordered')).toBe('met-lao-zhou')
    expect(advanceCommercialCafeStoryStage('met-lao-zhou')).toBe('coffee-delivered')
    expect(advanceCommercialCafeStoryStage('coffee-delivered')).toBe('intel-received')
    expect(advanceCommercialCafeStoryStage('intel-received')).toBe('ready-to-leave')
    expect(advanceCommercialCafeStoryStage('ready-to-leave')).toBe('complete')
    expect(advanceCommercialCafeStoryStage('complete')).toBe('complete')
  })

  it('survives save reload without changing incense or blinds state', () => {
    const storage = createStorage()
    let save = createInitialPlayerSave('commercial-cafe')
    save = recordPlayerSceneState(save, 'commercial-cafe', commercialCafeStoryStageKey, 'intel-received')
    save = recordPlayerSceneState(save, 'jijia-ancestral-interior', 'incenseLitAt', 1234)
    save = recordPlayerSceneState(save, 'zhongshuyuan-office', 'blindsOpen', false)

    savePlayerSave(save, storage, 5678)
    const restored = loadPlayerSave(storage)

    expect(commercialCafeStoryStageFromSceneState(restored.sceneState['commercial-cafe'])).toBe('intel-received')
    expect(restored.sceneState['jijia-ancestral-interior']).toEqual({ incenseLitAt: 1234 })
    expect(restored.sceneState['zhongshuyuan-office']).toEqual({ blindsOpen: false })
  })
})
