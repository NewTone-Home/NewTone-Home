import { describe, expect, it } from 'vitest'
import { continuousCafeRoomId } from '../src/center/runtime/continuousCafe'
import { defaultLaoZhouCafeSeatId, laoZhouCafeSeatPairs, withLaoZhouCafeSeat } from '../src/center/runtime/commercialCafeSeatSelection'
import { findMainlinePath, isWalkableMainlinePoint, mainlineSafeSpawnValidationDecision, resolveMainlineSafeSpawnPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createInitialPlayerSave, recordPlayerScenePosition } from '../src/center/runtime/playerSave'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const baseScene = mainlineScenes['commercial-street']
const cafeRoom = baseScene.rooms.find((room) => room.id === continuousCafeRoomId)!
const cafeEntry = baseScene.passages.find((passage) => passage.id === 'street-cafe-entry')!.crossingTargets[0]
const options = { screenMetrics: sceneDesignReferenceMetrics, actorId: 'protagonist' }

describe('Cafe resume-position recovery', () => {
  it('preserves a walkable saved point when it still connects to the inside Cafe entrance', () => {
    const safe = resolveMainlineSafeSpawnPosition(baseScene, cafeEntry, {}, options)

    expect(safe).toEqual(cafeEntry)
  })

  it('defers a resized Cafe spawn check while seated without consuming the pending key', () => {
    const beforeResize = 'commercial-street:141.79:18.03:411:914'
    const afterResize = 'commercial-street:141.79:18.03:360:800'

    expect(mainlineSafeSpawnValidationDecision('commercial-street', 'commercial-cafe-right-window-upper-group-chair-bottom', beforeResize, afterResize)).toBe('defer-active-seat')
    expect(mainlineSafeSpawnValidationDecision('commercial-street', null, beforeResize, afterResize)).toBe('validate')
    expect(mainlineSafeSpawnValidationDecision('commercial-street', null, afterResize, afterResize)).toBe('already-validated')
  })

  it('moves the reported upper-right table pocket to a nearby walkable point connected to the door', () => {
    const trapped = { x: 141.7916667, y: 16.55536296 }
    expect(isWalkableMainlinePoint(trapped, baseScene, {}, options)).toBe(true)
    expect(findMainlinePath(trapped, cafeEntry, baseScene, {}, options)).toBeNull()

    const safe = resolveMainlineSafeSpawnPosition(baseScene, trapped, {}, options)

    expect(safe).not.toBeNull()
    expect(safe).not.toEqual(trapped)
    expect(safe!.x).toBeGreaterThan(cafeRoom.bounds.x)
    expect(safe!.x).toBeLessThan(cafeRoom.bounds.x + cafeRoom.bounds.width)
    expect(safe!.y).toBeGreaterThan(cafeRoom.bounds.y)
    expect(safe!.y).toBeLessThan(cafeRoom.bounds.y + cafeRoom.bounds.height)
    expect(isWalkableMainlinePoint(safe!, baseScene, {}, options)).toBe(true)
    expect(findMainlinePath(safe!, cafeEntry, baseScene, {}, options)).not.toBeNull()
  })

  it.each(laoZhouCafeSeatPairs().map(([first, second]) => [first.id, second.id] as const))(
    'restores a saved seat point near a connected route with Lao Zhou at either seat (%s / %s)',
    (firstSeatId, secondSeatId) => {
      for (const laoZhouSeatId of [firstSeatId, secondSeatId]) {
        const playerSeatId = laoZhouSeatId === firstSeatId ? secondSeatId : firstSeatId
        const scene = withLaoZhouCafeSeat(baseScene, laoZhouSeatId)
        const playerSeat = scene.objects.find((entity) => entity.id === playerSeatId)!
        const savedSeatPoint = playerSeat.seat!.sit
        const resolved = resolveMainlineSafeSpawnPosition(scene, savedSeatPoint, {}, options)

        expect(resolved, `${laoZhouSeatId} / ${playerSeatId}`).not.toBeNull()
        expect(isWalkableMainlinePoint(resolved!, scene, {}, options)).toBe(true)
        expect(findMainlinePath(resolved!, cafeEntry, scene, {}, options)).not.toBeNull()
      }
    },
  )

  it('persists the corrected position through the existing position updater without changing save progress', () => {
    const start = createInitialPlayerSave('commercial-street')
    const save = {
      ...start,
      currentPosition: { x: 141.7916667, y: 16.55536296 },
      scenePositions: { 'commercial-street': { x: 141.7916667, y: 16.55536296 } },
      sceneState: { 'commercial-street': {
        commercialCafeNarrativeCursor: 14,
        commercialCafeStoryStatus: 'complete',
        milkTeaHeld: true,
        rideDestination: 'yonghe-mining-perimeter',
        rideDriverArrivesAt: 1_000,
        rideRequestedAt: 500,
      } },
      gameTimeMs: 12 * 60 * 60 * 1000 + 36 * 60 * 1000,
      phoneNotifications: [{ id: 'ride-order', kind: 'ride' as const, createdAt: 1 }],
      laoZhouCafeSeatId: defaultLaoZhouCafeSeatId,
    }
    const corrected = resolveMainlineSafeSpawnPosition(baseScene, save.currentPosition!, {}, options)!
    const updated = recordPlayerScenePosition(save, 'commercial-street', corrected)

    expect(updated.currentPosition).toEqual(corrected)
    expect(updated.scenePositions['commercial-street']).toEqual(corrected)
    expect(updated.currentSceneId).toBe(save.currentSceneId)
    expect(updated.sceneState).toEqual(save.sceneState)
    expect(updated.gameTimeMs).toBe(save.gameTimeMs)
    expect(updated.phoneNotifications).toEqual(save.phoneNotifications)
    expect(updated.phoneDevice).toEqual(save.phoneDevice)
    expect(updated.storyClock).toEqual(save.storyClock)
    expect(updated.laoZhouCafeSeatId).toBe(save.laoZhouCafeSeatId)
    expect(updated.updatedAt).toBe(save.updatedAt)
    expect({ ...updated, currentPosition: save.currentPosition, scenePositions: save.scenePositions }).toEqual(save)
  })
})
