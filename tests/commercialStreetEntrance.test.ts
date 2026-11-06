import { describe, expect, it } from 'vitest'
import { mainlineScenes, mainlineStorefrontApproach } from '../src/center/runtime/mainlineScenes'
import { mainlineSceneBlueprints } from '../src/center/runtime/mainlineSceneModel'
import { commercialStreetCameraPages, commercialStreetPageIndex } from '../src/center/runtime/commercialStreetCamera'
import { isWalkableMainlinePoint, resolveMainlineSafeSpawnPosition, findMainlinePath, resolveMainlineNpcPosition, canActorReachPassageApproach } from '../src/center/runtime/mainlineNavigation'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineProtagonistDotFootprint, mainlineLabelFootprint, mainlineSceneFootprint } from '../src/center/runtime/sceneLayout'
import { clearPlayerSave, createInitialPlayerSave, loadPlayerSave, sanitizePlayerSave, createPositionSaveCoordinator, recordPlayerScenePosition, savePlayerSave } from '../src/center/runtime/playerSave'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { activeStorefrontPresentationOwner, activeStorefrontInteriorOwner } from '../src/center/runtime/storefrontPresentation'

const scene = mainlineScenes['commercial-street']
const options = { screenMetrics: sceneDesignReferenceMetrics }

describe('first fruit-tea frontage district entrance', () => {
  it('derives both arrivals from the aligned first door public-side approach', () => {
    const blueprint = mainlineSceneBlueprints['commercial-street']
    const front = blueprint.portals.find(portal => portal.id === 'commercial-north-slot-1-entry')!
    const lane = scene.rooms.find(room => room.id === front.fromRoomId)!
    const approach = mainlineStorefrontApproach(scene, scene.storefronts.find(storefront => storefront.id === 'commercial-north-slot-1')!)
    expect(scene.initialPlayerPosition).toEqual({ x: approach.x, y: approach.y + 2 })
    expect(scene.initialPlayerPosition.y).toBeLessThan(lane.bounds.y + lane.bounds.height / 2)
    expect(activeStorefrontInteriorOwner(scene, scene.initialPlayerPosition)).toBeNull()
    expect(scene.rideArrivalPosition).toEqual(scene.initialPlayerPosition)
    expect(isWalkableMainlinePoint(scene.initialPlayerPosition, scene, {}, options)).toBe(true)
    expect(resolveMainlineSafeSpawnPosition(scene, scene.initialPlayerPosition, {}, options)).toEqual(scene.initialPlayerPosition)
  })

  it('clears real startup actor footprints and can leave or reach the actual door with live occupancy', () => {
    const start = scene.initialPlayerPosition
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(scene, start, {}, sceneDesignReferenceMetrics, new Map([['commercial-north-slot-1', 'revealed']]))
    const navigationRuntime = createNavigationRuntime()
    for (const npc of scene.npcs) {
      const position = resolveMainlineNpcPosition(scene, npc.id, {}, { geometrySnapshot, screenMetrics: sceneDesignReferenceMetrics })
      const box = mainlineSceneFootprint(scene, mainlineLabelFootprint(npc.label, position, sceneDesignReferenceMetrics, { lineHeight: 1 }), sceneDesignReferenceMetrics)
      navigationRuntime.registerActor(npc.id, position, { width: box.width, height: box.height })
    }
    const actorFootprint = mainlineProtagonistDotFootprint(start, sceneDesignReferenceMetrics, scene.id)
    navigationRuntime.registerActor('protagonist', start, actorFootprint)
    const live = { ...options, geometrySnapshot, navigationRuntime, actorId: 'protagonist', actorFootprint }
    const approach = mainlineStorefrontApproach(scene, scene.storefronts.find(storefront => storefront.id === 'commercial-north-slot-1')!)
    // This is the missed regression: static legality alone approved the old birth point.
    expect(isWalkableMainlinePoint(approach, scene, {}, { ...live, navigationRuntime: undefined })).toBe(true)
    expect(isWalkableMainlinePoint(approach, scene, {}, live)).toBe(false)
    expect(isWalkableMainlinePoint(start, scene, {}, live)).toBe(true)
    expect(findMainlinePath(start, { x: start.x + 4, y: 50.259 }, scene, {}, live)).not.toBeNull()
    expect(canActorReachPassageApproach(scene, scene.passages.find(passage => passage.id === 'commercial-north-slot-1-entry')!, start, {}, live)?.path).not.toBeNull()
  })

  it('holds the visible first facade baseline until entry is ready, then uses its normal proximity owner', () => {
    expect(activeStorefrontPresentationOwner(scene, scene.initialPlayerPosition, false)).toBeNull()
    expect(activeStorefrontPresentationOwner(scene, scene.initialPlayerPosition, true)).toBe('commercial-north-slot-1')
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

  it('does not let pagehide or pending state commits resurrect a deliberately reset save', () => {
    const values = new Map<string, string>([['newtone-public-release-cutover-v1', 'center-v1']])
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    let current = createInitialPlayerSave()
    const create = () => createPositionSaveCoordinator({ getSave: () => current, setSave: save => { current = save }, getCurrentSceneId: () => 'commercial-street', recordPosition: recordPlayerScenePosition, persist: save => savePlayerSave(save, storage, 1000) })
    const departing = create()
    departing.queue('commercial-street', { x: 80, y: 50 })
    clearPlayerSave(storage)
    departing.flush('commercial-street')
    departing.commit(save => ({ ...save, updatedAt: 3 }))
    expect(storage.getItem('newtone-player-save-v1')).toBeNull()
    const restarted = create()
    restarted.queue('commercial-street', scene.initialPlayerPosition)
    restarted.flush('commercial-street')
    expect(loadPlayerSave(storage).currentPosition).toEqual(scene.initialPlayerPosition)
  })
})
