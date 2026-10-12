import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineRideZones } from '../src/center/runtime/mainlineRide'
import { phoneRideMapTargetZones } from '../src/center/runtime/phoneRideMapModel'

describe('Ride local map target zones', () => {
  for (const rideZone of mainlineRideZones) {
    it('uses authored pickup exits and passages for ' + rideZone.pickupSceneId, () => {
      for (const sceneId of rideZone.scenes) {
        const scene = mainlineScenes[sceneId]
        const zones = phoneRideMapTargetZones(scene, sceneId, rideZone.pickupSceneId)
        const expectedCount = sceneId === rideZone.pickupSceneId
          ? scene.externalExits.length
          : Number(scene.passages.some((passage) => passage.targetSceneId === rideZone.pickupSceneId))
        expect(expectedCount).toBeGreaterThan(0)
        expect(zones).toHaveLength(expectedCount)
        for (const zone of zones) {
          expect(zone.bounds.width).toBeGreaterThan(0)
          expect(zone.bounds.height).toBeGreaterThan(0)
          expect(Number.isFinite(zone.bounds.x + zone.bounds.y + zone.bounds.width + zone.bounds.height)).toBe(true)
        }
      }
    })
  }

  it('keeps the Street exit target within the actual open-ended trigger edge', () => {
    const scene = mainlineScenes['commercial-street']
    const exit = scene.externalExits[0]
    const zone = phoneRideMapTargetZones(scene, 'commercial-street', 'commercial-street')[0]
    expect(zone.bounds.x + zone.bounds.width / 2).toBeCloseTo(exit.threshold)
    expect(zone.bounds.y).toBe(scene.walkBounds.y)
    expect(zone.bounds.height).toBe(scene.walkBounds.height)
  })
})
