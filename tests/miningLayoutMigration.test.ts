import { describe, expect, it } from 'vitest'
import fixtures from './fixtures/miningLegacyRoomSaves.json'
import { createInitialPlayerSave, loadPlayerSave, recordPlayerScenePosition, sanitizePlayerSave } from '../src/center/runtime/playerSave'
import { currentMiningRoomId, legacyMiningGridRooms, type MiningSceneId } from '../src/center/runtime/miningLayoutMigration'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { findMainlinePath, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { sceneGridTransform } from '../src/center/runtime/sceneGridRollout'

const options = { screenMetrics: sceneDesignReferenceMetrics, actorId: 'protagonist', actorFootprint: { width: 11 / 19.2, height: 11 / 10.8 }, openPassageIds: new Set<string>() }
const assertPublicRecovery = (id: MiningSceneId, point: { x: number; y: number }, roomId: string) => {
  const scene = mainlineScenes[id]
  expect(currentMiningRoomId(id, point)).toBe(roomId)
  expect(isWalkableMainlinePoint(point, scene, {}, options)).toBe(true)
  const seed = scene.passages.find(p => p.toRoomId === roomId && p.access === 'open')!.crossingTargets[0]
  expect(findMainlinePath(seed, point, scene, {}, options)).not.toBeNull()
  expect(scene.passages.filter(p => p.access === 'locked').length).toBeGreaterThan(0)
}

describe('one-time mine layout migration by old room identity', () => {
  for (const fixture of fixtures) it(`recovers ${fixture.name} in the same public shop and preserves non-position progress`, () => {
    const save = sanitizePlayerSave(fixture.source)
    assertPublicRecovery(save.currentSceneId as MiningSceneId, save.currentPosition!, fixture.expectedRoom)
    expect(save.miningLayoutVersion).toBe(2)
    expect(save.miningPositionBackup?.current).toEqual({ sceneId: fixture.source.currentSceneId, position: fixture.source.currentPosition })
    expect(save.sceneState).toEqual(fixture.source.sceneState)
    expect(save.storyClock).toEqual(fixture.source.storyClock)
    expect(save.phoneDevice).toBe(fixture.source.phoneDevice)
    expect(save.phoneContactNotes).toEqual(fixture.source.phoneContactNotes)
    expect(save.phoneNotes).toEqual(fixture.source.phoneNotes)
    expect(save.phoneNotifications).toEqual(fixture.source.phoneNotifications)
    expect(save.updatedAt).toBe(fixture.source.updatedAt)
    expect(sanitizePlayerSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
  })

  it('migrates both remembered aliases independently while the current player is elsewhere', () => {
    const source = { ...fixtures[0].source, currentSceneId: 'commercial-street', currentPosition: { x: 80, y: 50 }, scenePositions: { 'yonghe-eatery': { x: 30, y: 30 }, 'yonghe-mining-perimeter': { x: 30, y: 46.888974 }, 'commercial-street': { x: 80, y: 50 } } }
    const save = sanitizePlayerSave(source)
    expect(save.currentPosition).toEqual(source.currentPosition)
    assertPublicRecovery('yonghe-eatery', save.scenePositions['yonghe-eatery']!, 'mining-shop-2-interior')
    assertPublicRecovery('yonghe-mining-perimeter', save.scenePositions['yonghe-mining-perimeter']!, 'mining-shop-3-interior')
    expect(save.miningPositionBackup?.scenes).toEqual({ 'yonghe-eatery': { x: 30, y: 30 }, 'yonghe-mining-perimeter': { x: 30, y: 46.888974 } })
    expect(sanitizePlayerSave(save)).toEqual(save)
  })

  it('never applies the old-room interpretation to a newly versioned save', () => {
    const save = recordPlayerScenePosition(createInitialPlayerSave('yonghe-eatery'), 'yonghe-eatery', { x: 30, y: 30 })
    const clean = sanitizePlayerSave(save)
    expect(clean.currentPosition).toEqual({ x: 30, y: 30 })
    expect(clean.miningPositionRooms?.current).toBe(currentMiningRoomId('yonghe-eatery', { x: 30, y: 30 }))
    expect(clean.miningPositionBackup).toBeUndefined()
    expect(sanitizePlayerSave({ ...save, miningLayoutVersion: 3 }).miningLayoutVersion).toBe(3)
  })

  it('uses the frozen pre-grid transform only once when the source explicitly declares layout 1', () => {
    const old = sceneGridTransform('yonghe-eatery')!.inverse({ x: 30, y: 30 })
    const source = { ...fixtures[0].source, worldGridVersion: undefined, miningLayoutVersion: 1, currentPosition: old, scenePositions: { 'yonghe-eatery': old } }
    const save = sanitizePlayerSave(source)
    assertPublicRecovery('yonghe-eatery', save.currentPosition!, 'mining-shop-2-interior')
    expect(save.currentPosition!.x).toBeCloseTo(sanitizePlayerSave(fixtures[0].source).currentPosition!.x, 8)
    expect(sanitizePlayerSave(save)).toEqual(save)
  })

  it('uses a conservative semantic anchor and keeps the original for an unknown coordinate epoch', () => {
    const save = sanitizePlayerSave({ ...fixtures[0].source, worldGridVersion: undefined })
    assertPublicRecovery('yonghe-eatery', save.currentPosition!, 'mining-shop-2-interior')
    expect(save.miningPositionBackup?.sourceLayout).toBe('unknown-legacy')
    const lane = sanitizePlayerSave({ ...fixtures[1].source, worldGridVersion: undefined })
    expect(lane.miningPositionRooms?.current).toBe('mining-street-public-lane')
    expect(isWalkableMainlinePoint(lane.currentPosition!, mainlineScenes['yonghe-mining-perimeter'], {}, options)).toBe(true)
  })

  it('recovers obstructed old rear/counter positions inside the original public room, without unlocking anything', () => {
    const bounds = legacyMiningGridRooms[1].bounds
    for (const old of [{ x: bounds.x + .01, y: bounds.y + bounds.height * .82 }, { x: bounds.x + 1, y: bounds.y + 1 }]) {
      const save = sanitizePlayerSave({ ...fixtures[0].source, currentPosition: old, scenePositions: {} })
      assertPublicRecovery('yonghe-eatery', save.currentPosition!, 'mining-shop-2-interior')
      expect(save.sceneState).toEqual(fixtures[0].source.sceneState)
    }
  })

  it('recognizes all eight frozen shop identities without substituting an adjacent store', () => {
    for (const room of legacyMiningGridRooms) {
      const point = { x: room.bounds.x + room.bounds.width * .65, y: room.bounds.y + room.bounds.height * .5 }
      const save = sanitizePlayerSave({ ...fixtures[1].source, currentPosition: point, scenePositions: {} })
      assertPublicRecovery('yonghe-mining-perimeter', save.currentPosition!, room.id)
    }
  })

  it('does not accidentally tag old split-key storage with the new-save default version', () => {
    const values = new Map([
      ['newtone-public-release-cutover-v1', 'center-v1'],
      ['newtone.mainline.carried-phone.v2', JSON.stringify('inner')],
      ['newtone.mainline.scene-positions.v2', JSON.stringify({ 'yonghe-eatery': { x: 30, y: 30 } })],
    ])
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    const save = loadPlayerSave(storage, 'yonghe-eatery')
    expect(save.miningPositionBackup?.sourceLayout).toBe('unknown-legacy')
    assertPublicRecovery('yonghe-eatery', save.scenePositions['yonghe-eatery']!, 'mining-shop-2-interior')
  })
})
