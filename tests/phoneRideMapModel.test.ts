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
          ? Number(scene.externalExits.length > 0)
          : Number(scene.passages.some((passage) => passage.targetSceneId === rideZone.pickupSceneId))
        expect(expectedCount).toBeGreaterThan(0)
        expect(zones).toHaveLength(expectedCount)
        for (const zone of zones) {
          expect(zone.bounds.width).toBeGreaterThan(0)
          expect(zone.bounds.height).toBeGreaterThan(0)
          expect(Number.isFinite(zone.bounds.x + zone.bounds.y + zone.bounds.width + zone.bounds.height)).toBe(true)
          expect(zone.fillBounds.width).toBeGreaterThan(0)
          expect(zone.fillBounds.height).toBeGreaterThan(0)
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
    expect(zone.fillBounds).toEqual(zone.bounds)
  })

  it('fills the authored Office corridor floor around the real pickup opening', () => {
    const scene = mainlineScenes['zhongshuyuan-office']
    const zone = phoneRideMapTargetZones(scene, 'zhongshuyuan-office', 'zhongshuyuan-office')[0]
    const corridor = scene.rooms.find((room) => room.id === 'zhongshuyuan-office-corridor')!
    expect(zone.bounds.x + zone.bounds.width / 2).toBeCloseTo(scene.externalExits[0].threshold)
    expect(zone.fillBounds).toEqual(corridor.bounds)
    expect(zone.fillBounds).not.toEqual(scene.walkBounds)
  })

  it('uses the Café walkable floor for its authored Street doorway', () => {
    const scene = mainlineScenes['commercial-cafe']
    const zone = phoneRideMapTargetZones(scene, 'commercial-cafe', 'commercial-street')[0]
    expect(zone.bounds.width).toBeGreaterThan(0)
    expect(zone.fillBounds).toEqual(scene.walkBounds)
  })
})
