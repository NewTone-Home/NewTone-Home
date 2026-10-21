import { describe, expect, it } from 'vitest'
import { createInitialPlayerSave, hasResumablePlayerSave, loadPlayerSave, sanitizePlayerSave, PLAYER_SAVE_STORAGE_KEY } from '../src/center/runtime/playerSave'
import { mainlineRespawnSceneId, resolveMainlineSceneId } from '../src/center/runtime/mainlineScenes'
import {migratePreGridPosition} from '../src/center/runtime/sceneGridRollout'
const storage = () => {
  const data = new Map([['newtone-public-release-cutover-v1', 'center-v1']])
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}
describe('paired mainline initial state without resetting valid journeys', () => {
  it('starts a missing or unreadable save on the street with the inner phone', () => {
    const store = storage()
    expect(mainlineRespawnSceneId).toBe('commercial-street')
    expect(createInitialPlayerSave()).toMatchObject({ currentSceneId: 'commercial-street', phoneDevice: 'inner' })
    expect(loadPlayerSave(store)).toMatchObject({ currentSceneId: 'commercial-street', phoneDevice: 'inner', currentPosition: null })
    expect(hasResumablePlayerSave(store)).toBe(false)
    store.setItem(PLAYER_SAVE_STORAGE_KEY, '{broken')
    expect(loadPlayerSave(store)).toMatchObject({ currentSceneId: 'commercial-street', phoneDevice: 'inner' })
  })
  it.each([
    { currentSceneId: 'missing-scene', phoneDevice: 'surface', currentPosition: { x: 2, y: 3 } },
    { currentSceneId: 'commercial-cafe', phoneDevice: 'missing-phone', currentPosition: { x: 2, y: 3 } },
    { currentSceneId: 'jijia-ancestral-home', phoneDevice: 'surface', currentPosition: { x: 'bad', y: 3 } },
  ])('recovers a corrupt core as a pair while retaining progression: $currentSceneId', core => {
    const result = sanitizePlayerSave({ ...core, scenePositions: { 'commercial-street': { x: 135, y: -20 }, 'zhongshuyuan-office': { x: 20, y: 80 } }, sceneState: { 'commercial-cafe': { commercialCafeStoryStatus: 'complete' } } }, 'commercial-cafe')
    expect(result).toMatchObject({ currentSceneId: 'commercial-street', phoneDevice: 'inner', currentPosition: null, sceneState: { 'commercial-cafe': { commercialCafeStoryStatus: 'complete' } } })
    expect(result.scenePositions['commercial-street']).toBeUndefined()
    expect(result.scenePositions['zhongshuyuan-office']).toEqual(migratePreGridPosition('zhongshuyuan-office',{x:20,y:80}))
  })
  it.each(['inner', 'surface'] as const)('canonicalizes a valid legacy Cafe position while preserving the %s phone and other progress', phoneDevice => {
    const saved = { ...createInitialPlayerSave('commercial-cafe'), phoneDevice, currentPosition: { x: 58, y: 68 }, scenePositions: { 'commercial-cafe': { x: 58, y: 68 } }, updatedAt: 1000 }
    const migrated = sanitizePlayerSave(saved, 'commercial-street')
    const { currentSceneId: _scene, currentPosition: _point, scenePositions: _positions, ...progress } = saved
    expect(migrated).toMatchObject(progress)
    expect(migrated.currentSceneId).toBe('commercial-street')
    expect(migrated.currentPosition!.x).toBeCloseTo(139.96875, 5)
    expect(migrated.currentPosition!.y).toBeCloseTo(13.48043, 5)
    expect(migrated.scenePositions['commercial-street']).toEqual(migrated.currentPosition)
    expect(migrated.scenePositions['commercial-cafe']).toBeUndefined()
    expect(resolveMainlineSceneId('?scene=jijia-ancestral-home')).toBe('jijia-ancestral-home')
    expect(resolveMainlineSceneId('?scene=missing-scene')).toBeNull()
  })
  it('preserves identifiable surface-world legacy position and phone', () => {
    const store = storage()
    store.setItem('newtone.mainline.carried-phone.v2', JSON.stringify('surface'))
    store.setItem('newtone.mainline.scene-positions.v2', JSON.stringify({ 'jijia-ancestral-home': { x: 25, y: 50 } }))
    expect(loadPlayerSave(store)).toMatchObject({ currentSceneId: 'jijia-ancestral-home', phoneDevice: 'surface', currentPosition: migratePreGridPosition('jijia-ancestral-home',{x:25,y:50}) })
  })
  it('does not crash or auto-resume solely because the fresh default phone is inner', () => {
    expect(hasResumablePlayerSave({ getItem: () => { throw new Error('blocked') }, setItem: () => {}, removeItem: () => {} })).toBe(false)
  })
})
