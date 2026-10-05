import { describe, expect, it, vi } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { advanceMainlineCamera, mainlineCameraOffset, mainlineCameraTarget } from '../src/center/runtime/mainlineViewport'
import { commercialCafeFloorServiceDwellMs } from '../src/center/runtime/commercialCafeBehavior'
import { commercialStreetMilkTeaConsumePatch, commercialStreetMilkTeaHeld, commercialStreetMilkTeaPickupPatch, createCommercialStreetMilkTeaOrder } from '../src/center/runtime/commercialStreetMilkTea'
import { navigationBarrierBlocksTravel } from '../src/center/runtime/scenePathfinding'
import { mainlineRideAtPickup, mainlineRideOrderFromState, mainlineRideOrderPatch, mainlineRidePickupPosition, mainlineRideWalkingEtaMs, mainlineRideZone } from '../src/center/runtime/mainlineRide'
import { createInitialPlayerSave, recordPlayerSceneStatePatch, sanitizePlayerSave } from '../src/center/runtime/playerSave'
import { findMainlinePath, resolveMainlineSafeSpawnPosition } from '../src/center/runtime/mainlineNavigation'
import * as geometry from '../src/center/runtime/mainlineSceneGeometrySnapshot'

describe('P1 experience owners', () => {
  it('uses a central 30% deadzone and elapsed-time smooth follow without changing fixed scenes', () => {
    const scene = mainlineScenes['commercial-street']
    expect(mainlineCameraTarget(scene, { x: 55, y: 50 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
    const target = mainlineCameraTarget(scene, { x: 80, y: 50 }, { x: 0, y: 0 })
    expect(target.x).toBe(-15)
    const next = advanceMainlineCamera({ x: 0, y: 0 }, target, 16)
    expect(next.x).toBeLessThan(0)
    expect(next.x).toBeGreaterThan(target.x)
    const fixed = mainlineScenes['commercial-cafe']
    expect(mainlineCameraTarget(fixed, { x: 80, y: 80 }, { x: 0, y: 0 })).toEqual(mainlineCameraOffset(fixed, { x: 30, y: 30 }))
  })
  it('samples 1s and 5s tails with the majority in 2–4 seconds', () => {
    const samples = Array.from({ length: 100 }, (_, index) => commercialCafeFloorServiceDwellMs(() => index / 100))
    expect(samples.filter(ms => ms >= 2000 && ms <= 4000)).toHaveLength(80)
    expect(samples.filter(ms => ms === 1000)).toHaveLength(10)
    expect(samples.filter(ms => ms === 5000)).toHaveLength(10)
  })
  it('clears the held drink durably and permits a later real order', () => {
    let save = recordPlayerSceneStatePatch(createInitialPlayerSave('commercial-street'), 'commercial-street', commercialStreetMilkTeaPickupPatch())
    expect(commercialStreetMilkTeaHeld(save.sceneState['commercial-street'])).toBe(true)
    save = recordPlayerSceneStatePatch(save, 'commercial-street', commercialStreetMilkTeaConsumePatch())
    const restored = sanitizePlayerSave(JSON.parse(JSON.stringify(save)), 'commercial-street')
    expect(commercialStreetMilkTeaHeld(restored.sceneState['commercial-street'])).toBe(false)
    expect(createCommercialStreetMilkTeaOrder(restored.sceneState['commercial-street'], { drink: '原味奶茶', sugar: '正常', ice: '去冰' }, 1000, () => 0).readyAt).toBe(16000)
  })
  it('does not let two route segments cross through an on-line waypoint', () => {
    const barrier = { id: 'relation', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }
    expect(navigationBarrierBlocksTravel({ x: 5, y: -1 }, { x: 5, y: 0 }, barrier)).toBe(true)
    expect(navigationBarrierBlocksTravel({ x: 5, y: 0 }, { x: 5, y: 1 }, barrier)).toBe(true)
    expect(navigationBarrierBlocksTravel({ x: -2, y: -1 }, { x: -2, y: 1 }, barrier)).toBe(false)
  })
  it('owns interior ride requests in their formal region and persists the waiting order', () => {
    expect(mainlineRideZone('commercial-cafe')?.pickupSceneId).toBe('commercial-street')
    expect(mainlineRideZone('yonghe-eatery')?.pickupSceneId).toBe('yonghe-mining-perimeter')
    const order = { sourceSceneId: 'commercial-street' as const, targetSceneId: 'zhongshuyuan-office' as const, driverArrivesAt: 1000 }
    expect(mainlineRideOrderFromState({ 'commercial-street': mainlineRideOrderPatch(order) })).toEqual(order)
    expect(mainlineRideAtPickup(order, 'commercial-cafe', mainlineScenes['commercial-cafe'].initialPlayerPosition)).toBe(false)
    expect(mainlineRideAtPickup(order, 'commercial-street', mainlineRidePickupPosition('commercial-street'))).toBe(true)
    const eta = mainlineRideWalkingEtaMs('commercial-cafe', mainlineScenes['commercial-cafe'].initialPlayerPosition, { layout: {}, screenMetrics: { width: 1280, height: 720 } })
    expect(eta).not.toBeNull()
    expect(eta).toBeGreaterThan(0)
  })
  it('captures one geometry transaction for a path and spawn query', () => {
    const spy = vi.spyOn(geometry, 'createMainlineSceneGeometrySnapshot')
    const scene = mainlineScenes['commercial-street']
    resolveMainlineSafeSpawnPosition(scene, scene.initialPlayerPosition)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockClear()
    findMainlinePath(scene.initialPlayerPosition, { x: scene.initialPlayerPosition.x + 3, y: scene.initialPlayerPosition.y }, scene)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
