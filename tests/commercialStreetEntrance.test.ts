import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineSceneBlueprints } from '../src/center/runtime/mainlineSceneModel'
import { commercialStreetCameraPages, commercialStreetPageIndex } from '../src/center/runtime/commercialStreetCamera'
import { isWalkableMainlinePoint, resolveMainlineSafeSpawnPosition } from '../src/center/runtime/mainlineNavigation'
import { clearPlayerSave, createInitialPlayerSave, loadPlayerSave, sanitizePlayerSave } from '../src/center/runtime/playerSave'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const scene = mainlineScenes['commercial-street']
const options = { screenMetrics: sceneDesignReferenceMetrics }

describe('first fruit-tea frontage district entrance', () => {
  it('derives both arrivals from the aligned first door and the public lane midpoint', () => {
    const blueprint = mainlineSceneBlueprints['commercial-street']
    const front = blueprint.portals.find(portal => portal.id === 'commercial-north-slot-1-entry')!
    const lane = scene.rooms.find(room => room.id === front.fromRoomId)!
    expect(scene.initialPlayerPosition).toEqual({ x: front.endpoint.doorPosition.x, y: lane.bounds.y + lane.bounds.height / 2 })
    expect(scene.rideArrivalPosition).toEqual(scene.initialPlayerPosition)
    expect(isWalkableMainlinePoint(scene.initialPlayerPosition, scene, {}, options)).toBe(true)
    expect(resolveMainlineSafeSpawnPosition(scene, scene.initialPlayerPosition, {}, options)).toEqual(scene.initialPlayerPosition)
  })

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
    it(`starts on camera page one at ${viewport.width}x${viewport.height}`, () => {
      const pages = commercialStreetCameraPages(scene, viewport)
      expect(commercialStreetPageIndex(pages.centers, scene.initialPlayerPosition.x, pages.span)).toBe(0)
    })
  }

  it('new games and explicit reset discard remembered coordinates and use the scene entrance', () => {
    expect(createInitialPlayerSave()).toMatchObject({ currentSceneId: 'commercial-street', currentPosition: null, phoneDevice: 'inner', scenePositions: {} })
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    storage.setItem('newtone-player-save-v1', JSON.stringify({ ...createInitialPlayerSave(), currentPosition: { x: 80, y: 50 }, scenePositions: { 'commercial-street': { x: 80, y: 50 } } }))
    clearPlayerSave(storage)
    expect(loadPlayerSave(storage, 'commercial-street')).toMatchObject({ currentSceneId: 'commercial-street', currentPosition: null, scenePositions: {}, phoneDevice: 'inner' })
  })

  it('ordinary continuation preserves played position and progress instead of sending it to the entrance', () => {
    const old = { ...createInitialPlayerSave(), currentPosition: { x: 80, y: 50 }, scenePositions: { 'commercial-street': { x: 80, y: 50 } }, sceneState: { 'commercial-cafe': { commercialCafeStoryStatus: 'complete' } }, phoneContactNotes: { a: 'retained' } }
    const continued = sanitizePlayerSave(old, 'commercial-street')
    expect(continued.currentPosition).toEqual(old.currentPosition)
    expect(continued.scenePositions).toEqual(old.scenePositions)
    expect(continued.sceneState).toEqual(old.sceneState)
    expect(continued.phoneContactNotes).toEqual(old.phoneContactNotes)
  })
})
